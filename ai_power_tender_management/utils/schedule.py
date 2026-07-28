# Copyright (c) 2026, milind and contributors
# For license information, please see license.txt
"""
Baseline project schedule — normalisation, validation and rendering.

The AI returns a complete schedule (dates, total float and critical flags
included) rather than us running a CPM pass, so this module's job is to keep the
published numbers self-consistent: weights are rescaled to total exactly 100%,
and a set of cheap arithmetic checks surface the cases where the model's own
numbers contradict each other.

Rendering produces the two views the client expects, matching the reference
Primavera P6 export: the activity table and a time-scaled Gantt chart.

Both views render left-to-right even though the proposal is RTL — that is how
Primavera exports them, with the activity columns leading and the time axis
running chronologically rightwards. Arabic cells carry `unicode-bidi: plaintext`
so each string still picks its own direction.
"""

import re
from datetime import timedelta

import frappe
from frappe import _
from frappe.utils import cint, flt, getdate

from ai_power_tender_management.utils import cpm

# Bar colours follow the reference export: blue for normal float, red for the
# critical path, near-black diamonds for zero-duration milestones.
COLOR_NORMAL = "#5b9bd5"
COLOR_CRITICAL = "#e05a5a"
COLOR_MILESTONE = "#1f2430"

# Weekly columns stay readable up to roughly eighteen months; past that the
# chart is switched to monthly buckets so it still fits a printed page.
_MAX_WEEK_COLUMNS = 78

_MONTH_ABBR = (
	"Jan", "Feb", "Mar", "Apr", "May", "Jun",
	"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)
_MONTHS_AR = (
	"يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
	"يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
)

MILESTONE_TYPES = ("Start Milestone", "Finish Milestone")


# ---------------------------------------------------------------------------
# Predecessor parsing
# ---------------------------------------------------------------------------
# A link is "<activity id><relation><lag>", e.g. RAI-ENG-050SS+5. Activity ids
# themselves contain hyphens, so the relation and lag are peeled off the end
# rather than matched positionally.
_LAG_RE = re.compile(r"([+-]\s*\d+)\s*$")
_REL_RE = re.compile(r"(FS|SS|FF|SF)\s*$", re.IGNORECASE)


def parse_predecessors(raw):
	"""Parse a predecessor string into [{"id", "rel", "lag"}, ...]."""
	links = []
	for token in re.split(r"[,;\n]", raw or ""):
		token = token.strip()
		if not token:
			continue

		lag = 0
		match = _LAG_RE.search(token)
		if match:
			lag = cint(match.group(1).replace(" ", ""))
			token = token[: match.start()].strip()

		# Finish-to-Start is Primavera's default when no relation is written.
		rel = "FS"
		match = _REL_RE.search(token)
		if match:
			rel = match.group(1).upper()
			token = token[: match.start()].strip()

		if token:
			links.append({"id": token, "rel": rel, "lag": lag})
	return links


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------
def normalize_weights(rows):
	"""Rescale `weight_pct` across rows so the column totals exactly 100%."""
	if not rows:
		return

	total = sum(flt(getattr(r, "weight_pct", 0)) for r in rows)
	if total <= 0:
		# The model gave us nothing usable — fall back to an even split so the
		# column is at least coherent.
		share = round(100.0 / len(rows), 3)
		for row in rows:
			row.weight_pct = share
	else:
		factor = 100.0 / total
		for row in rows:
			row.weight_pct = round(flt(row.weight_pct) * factor, 3)

	# Rounding to three decimals leaves a few thousandths of drift; absorb it
	# into the heaviest row so the printed column really does add up to 100.
	drift = round(100.0 - sum(flt(r.weight_pct) for r in rows), 3)
	if drift:
		heaviest = max(rows, key=lambda r: flt(r.weight_pct))
		heaviest.weight_pct = round(flt(heaviest.weight_pct) + drift, 3)


def _is_milestone(row):
	return (getattr(row, "activity_type", "") or "") in MILESTONE_TYPES


FINISH_MILESTONE = "Finish Milestone"


def _phase_key(row):
	"""Phase an activity belongs to: the ID stem (CUTV-070 -> CUTV), else WBS level 1."""
	activity_id = (getattr(row, "activity_id", "") or "").strip()
	if "-" in activity_id:
		return activity_id.rsplit("-", 1)[0]
	return str(getattr(row, "wbs", "") or "").split(".")[0]


def link_open_ends(rows):
	"""
	Attach every dangling activity to its phase-end milestone with an FF link.

	An activity nothing depends on has its late finish pushed to the end of the
	project, so it reports float running into the hundreds of days — four Level
	of Effort rows came back with 524, 315, 245 and 182. The CPM arithmetic is
	right; the network is simply open at those points. Generation already gets
	this right most of the time (CUTP-120 arrived carrying CUTP-080FF and
	CUTP-090FF), so this closes the cases it misses rather than inventing a new
	convention.

	Mutates `predecessors` on the milestone rows and returns the links added as
	(activity, milestone) pairs.
	"""
	by_id = {}
	for row in rows:
		activity_id = (getattr(row, "activity_id", "") or "").strip()
		if activity_id and activity_id not in by_id:
			by_id[activity_id] = row

	preds = {
		activity_id: {l["id"] for l in parse_predecessors(getattr(row, "predecessors", ""))}
		for activity_id, row in by_id.items()
	}
	has_successor = set()
	for deps in preds.values():
		has_successor |= deps

	phase_end = {}
	for activity_id, row in by_id.items():
		if (getattr(row, "activity_type", "") or "") == FINISH_MILESTONE:
			phase_end.setdefault(_phase_key(row), activity_id)

	def depends_on(start, target):
		"""True when `start` already sits downstream of `target` — linking would cycle."""
		stack, seen = [start], set()
		while stack:
			for dep in preds.get(stack.pop(), ()):
				if dep == target:
					return True
				if dep not in seen:
					seen.add(dep)
					stack.append(dep)
		return False

	linked = []
	for activity_id, row in by_id.items():
		if activity_id in has_successor:
			continue
		# The completion milestone is meant to be the one open end.
		if (getattr(row, "activity_type", "") or "") == FINISH_MILESTONE:
			continue
		target = phase_end.get(_phase_key(row))
		if not target or target == activity_id or depends_on(activity_id, target):
			continue
		milestone = by_id[target]
		existing = (getattr(milestone, "predecessors", "") or "").strip().rstrip(",")
		token = f"{activity_id}FF"
		milestone.predecessors = f"{existing},{token}" if existing else token
		preds[target].add(activity_id)
		has_successor.add(activity_id)
		linked.append((activity_id, target))

	return linked


def apply_cpm(rows, project_start):
	"""
	Derive planned dates, total float and criticality from the activity network.

	The AI supplies activities, durations and predecessor links; those are facts
	about the work. Dates and float are arithmetic over the network, so they are
	computed here — asked to assert them directly the model marked 87% of
	activities critical, which is meaningless.

	Returns the CPM diagnostics dict (cyclic activities, dropped links, …).
	"""
	if not rows:
		return {}

	# Close open ends before the passes run, or their float is measured against
	# the end of the project instead of the end of their phase.
	linked = link_open_ends(rows)

	activities = {}
	for row in rows:
		activity_id = (getattr(row, "activity_id", "") or "").strip()
		if not activity_id or activity_id in activities:
			# Duplicates are reported by validate_schedule; both rows resolve to
			# the same node here rather than silently vanishing.
			continue
		activities[activity_id] = cpm.Activity(
			activity_id,
			cint(getattr(row, "original_duration", 0)),
			parse_predecessors(getattr(row, "predecessors", "")),
		)

	info = cpm.schedule_network(activities, getdate(project_start))

	for row in rows:
		node = activities.get((getattr(row, "activity_id", "") or "").strip())
		if not node:
			continue
		row.planned_start = node.early_start
		row.planned_finish = node.early_finish
		row.total_float = node.total_float
		row.is_critical = 1 if node.is_critical else 0

	info["open_ends_linked"] = linked
	return info


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_schedule(rows):
	"""
	Return human-readable warnings about an AI-produced schedule.

	These are arithmetic consistency checks, not a scheduling engine — they
	catch the cases where the model's own dates, float and links disagree with
	each other, which is the known trade-off of having it supply the dates.
	"""
	warnings = []
	if not rows:
		return warnings

	by_id = {}
	for row in rows:
		activity_id = (getattr(row, "activity_id", "") or "").strip()
		if not activity_id:
			warnings.append(_("Row {0}: missing Activity ID.").format(row.idx))
			continue
		if activity_id in by_id:
			warnings.append(_("Duplicate Activity ID: {0}").format(activity_id))
		by_id[activity_id] = row

	for row in rows:
		activity_id = (getattr(row, "activity_id", "") or "").strip() or f"#{row.idx}"
		start = getdate(row.planned_start) if row.planned_start else None
		finish = getdate(row.planned_finish) if row.planned_finish else None

		if not start or not finish:
			warnings.append(_("{0}: missing planned start or finish date.").format(activity_id))
		elif finish < start:
			warnings.append(_("{0}: finishes before it starts.").format(activity_id))

		if _is_milestone(row):
			if cint(row.original_duration) != 0:
				warnings.append(
					_("{0}: milestones must have zero duration (found {1}).").format(
						activity_id, cint(row.original_duration)
					)
				)
		elif cint(row.original_duration) <= 0:
			warnings.append(_("{0}: duration must be greater than zero.").format(activity_id))

		# Critical means zero slack; the two columns must agree.
		if cint(row.is_critical) and cint(row.total_float) != 0:
			warnings.append(
				_("{0}: marked critical but total float is {1}, not 0.").format(
					activity_id, cint(row.total_float)
				)
			)
		if not cint(row.is_critical) and cint(row.total_float) == 0:
			warnings.append(
				_("{0}: total float is 0 but the activity is not marked critical.").format(activity_id)
			)

		for link in parse_predecessors(row.predecessors):
			pred = by_id.get(link["id"])
			if not pred:
				warnings.append(
					_("{0}: predecessor {1} does not exist in this schedule.").format(
						activity_id, link["id"]
					)
				)
				continue

			# Only Finish-to-Start is checked: it is the one relation whose
			# violation is unambiguous without running a full forward pass.
			# A same-day handover (successor starts the day the predecessor
			# finishes) is normal practice, so only a genuine overlap is flagged
			# — otherwise nearly every row warns and the list gets ignored.
			if link["rel"] != "FS" or not start or not pred.planned_finish:
				continue
			pred_finish = getdate(pred.planned_finish)
			if start < pred_finish:
				warnings.append(
					_("{0}: starts on {1}, before predecessor {2} finishes ({3}).").format(
						activity_id, _fmt_date(start), link["id"], _fmt_date(pred_finish)
					)
				)

	total_weight = round(sum(flt(r.weight_pct) for r in rows), 3)
	if abs(total_weight - 100.0) > 0.01:
		warnings.append(_("Weights total {0}%, not 100%.").format(total_weight))

	# Open ends. An activity nothing depends on has its late finish pushed all
	# the way to the end of the project, so it reports float running into the
	# hundreds of days — the four Level of Effort rows on the first run showed
	# 524, 315, 245 and 182. The arithmetic is right; the network is incomplete.
	has_successor = set()
	for row in rows:
		for link in parse_predecessors(getattr(row, "predecessors", "")):
			has_successor.add(link["id"])
	open_ends = [
		(getattr(r, "activity_id", "") or "").strip()
		for r in rows
		if (getattr(r, "activity_id", "") or "").strip()
		and (getattr(r, "activity_id", "") or "").strip() not in has_successor
	]
	# The last activity legitimately has no successor; anything beyond that is a
	# dangling branch that never joins back to the completion milestone.
	if len(open_ends) > 1:
		warnings.append(
			_("{0} activities have no successor ({1}); their float is not meaningful "
			  "until they are linked to a phase-end milestone.").format(
				len(open_ends), ", ".join(open_ends[:8])
			)
		)

	return warnings


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------
def _fmt_date(value):
	"""Format a date the way the reference export does: 01-Aug-26."""
	if not value:
		return ""
	d = getdate(value)
	return f"{d.day:02d}-{_MONTH_ABBR[d.month - 1]}-{d.year % 100:02d}"


def _esc(value):
	return frappe.utils.escape_html("" if value is None else str(value))


def _schedule_bounds(rows):
	"""Earliest start and latest finish across the schedule."""
	starts = [getdate(r.planned_start) for r in rows if r.planned_start]
	finishes = [getdate(r.planned_finish) for r in rows if r.planned_finish]
	if not starts or not finishes:
		return None, None
	return min(starts), max(finishes)


def _week_start(d):
	"""Snap back to Saturday, the first working day of the 6-day week."""
	# Python weekdays run Monday=0 … Sunday=6, so Saturday is 5.
	return d - timedelta(days=(d.weekday() - 5) % 7)


def _build_buckets(start, finish):
	"""
	Build the Gantt time axis.

	Returns (buckets, monthly) where each bucket is {"start", "end", "label",
	"month"}. Weekly columns are used when they fit; longer projects fall back
	to monthly columns so the chart still prints.
	"""
	origin = _week_start(start)
	span_weeks = ((finish - origin).days // 7) + 1

	if span_weeks <= _MAX_WEEK_COLUMNS:
		buckets = []
		for i in range(span_weeks):
			bucket_start = origin + timedelta(days=7 * i)
			buckets.append({
				"start": bucket_start,
				"end": bucket_start + timedelta(days=6),
				"label": f"{bucket_start.day:02d}",
				"month": (bucket_start.year, bucket_start.month),
			})
		return buckets, False

	# Monthly fallback.
	buckets = []
	year, month = start.year, start.month
	while (year, month) <= (finish.year, finish.month):
		bucket_start = getdate(f"{year}-{month:02d}-01")
		next_year, next_month = (year + 1, 1) if month == 12 else (year, month + 1)
		bucket_end = getdate(f"{next_year}-{next_month:02d}-01") - timedelta(days=1)
		buckets.append({
			"start": bucket_start,
			"end": bucket_end,
			"label": _MONTH_ABBR[month - 1],
			"month": (year, month),
		})
		year, month = next_year, next_month
	return buckets, True


def _month_label(year, month):
	return f"{_MONTHS_AR[month - 1]} {year}"


# ---------------------------------------------------------------------------
# Summary band
# ---------------------------------------------------------------------------
def build_summary_html(rows):
	"""
	Headline figures, shown before the table.

	An evaluation committee wants the shape of the schedule before the detail;
	previously they had to derive it from 140-odd rows.
	"""
	if not rows:
		return ""

	start, finish = _schedule_bounds(rows)
	milestones = sum(1 for r in rows if _is_milestone(r))
	critical = sum(1 for r in rows if cint(r.is_critical))
	months = ""
	if start and finish:
		months = "{0} months".format(round(((finish - start).days / 30.44)) or 1)

	# Labels are deliberately untranslated. The activity table below prints its
	# headers in English (as the reference baseline does), and routing these
	# through _() left the band half-Arabic — Frappe ships translations for
	# "Duration" and "Activities" but not for the other four.
	facts = [
		("Project Start", _fmt_date(start)),
		("Project Finish", _fmt_date(finish)),
		("Duration", months),
		("Activities", str(len(rows))),
		("Milestones", str(milestones)),
		("On Critical Path", str(critical)),
	]
	cells = "".join(
		f"<div class='fact'><span class='k'>{_esc(k)}</span>"
		f"<span class='v'>{_esc(v)}</span></div>"
		for k, v in facts
	)
	return f"<div class='sched-summary'>{cells}</div>"


# ---------------------------------------------------------------------------
# View 1 — activity table
# ---------------------------------------------------------------------------
# (label, relative column width). `Calendar` and `Status` are deliberately not
# columns: every row of a baseline carries the same value, so they waste the
# width the Arabic activity name needs. Both are stated once in the caption.
_TABLE_COLUMNS = (
	("WBS", 4),
	("Activity ID", 8),
	("اسم النشاط", 30),
	("Activity Type", 8),
	("Duration", 5),
	("Planned Start", 7),
	("Planned Finish", 7),
	("Predecessors", 13),
	("Float", 4),
	("Critical", 4),
	("Weight %", 5),
	("Primary Resource", 12),
)


def _wbs_sort_key(code):
	"""Order WBS codes numerically (2.10 after 2.9, not before)."""
	parts = str(code or "").split(".")
	try:
		return tuple(int(p) for p in parts)
	except ValueError:
		return (9999,)


def _wbs_ordered(rows):
	"""
	Rows sorted by WBS, ties broken by their original position.

	Generation does not guarantee that a phase's rows arrive together: one row
	carrying WBS 6.2 landed between the 6.3 rows, which printed the "6.2" and
	"6.3" group headers twice each. Sorting first makes every code appear once.
	"""
	return [r for _, _, r in sorted(
		((_wbs_sort_key(getattr(r, "wbs", "")), i, r) for i, r in enumerate(rows)),
		key=lambda t: (t[0], t[1]),
	)]


def _group_rows_by_wbs(rows):
	"""Yield (wbs, [rows]) runs in WBS order, so each code heads exactly one group."""
	groups = []
	for row in _wbs_ordered(rows):
		code = (getattr(row, "wbs", "") or "").strip()
		if groups and groups[-1][0] == code:
			groups[-1][1].append(row)
		else:
			groups.append((code, [row]))
	return groups


def _critical_cell(critical):
	"""Critical shown as a coloured chip — scannable down a long column."""
	if critical:
		return f"<td class='num'><span class='chip crit'>{_esc('نعم')}</span></td>"
	return f"<td class='num'><span class='chip'>{_esc('لا')}</span></td>"


def build_activity_table_html(rows):
	"""Render the baseline activity table."""
	if not rows:
		return ""

	total = sum(w for _label, w in _TABLE_COLUMNS)
	cols = "".join(f"<col style='width:{100 * w / total:.2f}%'>" for _label, w in _TABLE_COLUMNS)
	head = "".join(f"<th>{_esc(label)}</th>" for label, _w in _TABLE_COLUMNS)
	span = len(_TABLE_COLUMNS)

	body = []
	for wbs, group in _group_rows_by_wbs(rows):
		if wbs:
			body.append(
				f"<tr class='wbs-row'><td colspan='{span}'>"
				f"<b>{_esc(wbs)}</b> &nbsp; {_esc(_('{0} activities').format(len(group)))}"
				f"</td></tr>"
			)
		for row in group:
			critical = cint(row.is_critical)
			milestone = _is_milestone(row)
			cells = [
				f"<td class='num'>{_esc(row.wbs)}</td>",
				f"<td class='id'>{_esc(row.activity_id)}</td>",
				f"<td class='ar'>{_esc(row.activity_name)}</td>",
				f"<td class='ty'>{_esc(row.activity_type)}</td>",
				f"<td class='num'>{cint(row.original_duration)}</td>",
				f"<td class='num'>{_esc(_fmt_date(row.planned_start))}</td>",
				f"<td class='num'>{_esc(_fmt_date(row.planned_finish))}</td>",
				f"<td class='pred'>{_esc(row.predecessors)}</td>",
				f"<td class='num'>{cint(row.total_float)}</td>",
				_critical_cell(critical),
				f"<td class='num'>{flt(row.weight_pct):.3f}%</td>",
				f"<td class='ar'>{_esc(row.primary_resource)}</td>",
			]
			classes = []
			if critical:
				classes.append("is-critical")
			if milestone:
				classes.append("is-milestone")
			cls = f" class='{' '.join(classes)}'" if classes else ""
			body.append(f"<tr{cls}>{''.join(cells)}</tr>")

	caption = _("Calendar 6D-8H (six working days a week). All activities Not Started at baseline.")
	return (
		"<table class='sched-table'>"
		f"<colgroup>{cols}</colgroup>"
		f"<thead><tr>{head}</tr></thead>"
		f"<tbody>{''.join(body)}</tbody>"
		"</table>"
		f"<div class='sched-note'>{_esc(caption)}</div>"
	)


# ---------------------------------------------------------------------------
# View 2 — Gantt chart
# ---------------------------------------------------------------------------
# Fewer columns than the table: the chart carries the timing visually, so only
# what is needed to identify a row stays. Duration is deliberately absent — the
# length of the bar already shows it, and the width is worth more to the name.
_GANTT_COLUMNS = (
	("WBS", 6),
	("Activity ID", 13),
	("اسم النشاط", 40),
	("البداية", 12),
	("النهاية", 12),
	("Float", 6),
	("Weight %", 9),
)


def _gantt_info_share(bucket_count):
	"""
	Share of the page width given to the activity-info block.

	A monthly chart needs very little room per column, so starving the info
	block to a fixed 34% left every column clipped (RECON-040 -> "RECO"). The
	timescale only takes what it actually needs.
	"""
	if bucket_count <= 32:
		return 50.0
	if bucket_count <= 52:
		return 42.0
	return 34.0


def build_gantt_html(rows):
	"""Render the time-scaled Gantt chart."""
	if not rows:
		return ""

	start, finish = _schedule_bounds(rows)
	if not start or not finish:
		return ""

	buckets, monthly = _build_buckets(start, finish)

	info_share = _gantt_info_share(len(buckets))
	info_total = sum(w for _label, w in _GANTT_COLUMNS)
	cols = "".join(
		f"<col style='width:{info_share * w / info_total:.2f}%'>"
		for _label, w in _GANTT_COLUMNS
	)
	tick_width = (100.0 - info_share) / len(buckets)
	cols += f"<col style='width:{tick_width:.3f}%'>" * len(buckets)

	# Month band: one cell per run of buckets sharing a month.
	month_cells = []
	span = 0
	current = buckets[0]["month"]
	for bucket in buckets:
		if bucket["month"] == current:
			span += 1
			continue
		month_cells.append(f"<th colspan='{span}' class='month'>{_esc(_month_label(*current))}</th>")
		current, span = bucket["month"], 1
	month_cells.append(f"<th colspan='{span}' class='month'>{_esc(_month_label(*current))}</th>")

	info_span = len(_GANTT_COLUMNS)
	head = (
		f"<tr><th colspan='{info_span}' class='info-band'>{_esc('بيانات النشاط')}</th>"
		f"{''.join(month_cells)}</tr>"
		"<tr>"
		+ "".join(f"<th class='info'>{_esc(header)}</th>" for header, _w in _GANTT_COLUMNS)
		+ "".join(f"<th class='tick'>{_esc(b['label'])}</th>" for b in buckets)
		+ "</tr>"
	)

	body = []
	# Same order as the activity table, so the two views line up row for row.
	for row in _wbs_ordered(rows):
		critical = cint(row.is_critical)
		milestone = _is_milestone(row)
		row_start = getdate(row.planned_start) if row.planned_start else None
		row_finish = getdate(row.planned_finish) if row.planned_finish else None

		# An activity always covers a contiguous date range, so its bar is drawn
		# as ONE cell spanning the whole run rather than one cell per bucket.
		# Per-bucket cells left hairline gaps between the segments — sub-pixel
		# rounding across 27 columns — so the bar read as a row of squares.
		painted = []
		if row_start and row_finish:
			painted = [
				i for i, b in enumerate(buckets)
				if row_start <= b["end"] and row_finish >= b["start"]
			]

		if not painted:
			bars = [f"<td class='cell' colspan='{len(buckets)}'></td>"]
		else:
			first, last = painted[0], painted[-1]
			run = last - first + 1
			bars = []
			if first:
				bars.append(f"<td class='cell' colspan='{first}'></td>")
			if milestone:
				bars.append(
					f"<td class='cell' colspan='{run}'>"
					f"<span class='ms' style='color:{COLOR_MILESTONE}'>&#9670;</span></td>"
				)
			else:
				color = COLOR_CRITICAL if critical else COLOR_NORMAL
				bars.append(
					f"<td class='cell run' colspan='{run}'>"
					f"<span class='bar' style='background:{color}'></span></td>"
				)
			trailing = len(buckets) - last - 1
			if trailing:
				bars.append(f"<td class='cell' colspan='{trailing}'></td>")

		info = [
			f"<td class='info num'>{_esc(row.wbs)}</td>",
			f"<td class='info id'>{_esc(row.activity_id)}</td>",
			f"<td class='info ar clip'>{_esc(row.activity_name)}</td>",
			f"<td class='info num'>{_esc(_fmt_date(row.planned_start))}</td>",
			f"<td class='info num'>{_esc(_fmt_date(row.planned_finish))}</td>",
			f"<td class='info num'>{cint(row.total_float)}</td>",
			f"<td class='info num'>{flt(row.weight_pct):.3f}%</td>",
		]
		classes = []
		if critical:
			classes.append("is-critical")
		if milestone:
			classes.append("is-milestone")
		cls = f" class='{' '.join(classes)}'" if classes else ""
		body.append(f"<tr{cls}>{''.join(info)}{''.join(bars)}</tr>")

	scale_note = _("Monthly scale") if monthly else _("Weekly scale")
	return (
		"<table class='gantt'>"
		f"<colgroup>{cols}</colgroup>"
		f"<thead>{head}</thead>"
		f"<tbody>{''.join(body)}</tbody>"
		"</table>"
		"<div class='gantt-legend'>"
		f"<span class='li'><i style='background:{COLOR_NORMAL}'></i>{_esc(_('Normal float'))}</span>"
		f"<span class='li'><i style='background:{COLOR_CRITICAL}'></i>{_esc(_('Critical path'))}</span>"
		f"<span class='li'><i style='background:{COLOR_MILESTONE}'></i>{_esc(_('Milestone'))}</span>"
		f"<span class='li scale'>{_esc(scale_note)}</span>"
		"</div>"
	)


# ---------------------------------------------------------------------------
# Combined block + styles
# ---------------------------------------------------------------------------
# No flexbox `gap` anywhere below: wkhtmltopdf runs an old WebKit that ignores
# it, which ran the legend items together in printed output.
SCHEDULE_CSS = """
.sched-wrap { direction: ltr; }
.sched-wrap h3 { font-size: 14px; margin: 0 0 8px; color: #4f46e5; direction: rtl; text-align: right; }
.sched-wrap table { width: 100%; border-collapse: collapse; font-size: 8px; table-layout: fixed; }
.sched-wrap th, .sched-wrap td { border: 1px solid #c8ccd6; padding: 2px 3px; overflow: hidden;
  vertical-align: top; }
.sched-wrap thead th { background: #2f5597; color: #fff; font-weight: 600; text-align: center;
  vertical-align: middle; }
.sched-wrap tbody tr:nth-child(even) { background: #f4f7fc; }
.sched-wrap tr.is-critical td { background: #fdeaea; }
.sched-wrap tr.is-milestone td { font-weight: 700; background: #eef0f6; }
.sched-wrap tr.wbs-row td { background: #dfe6f3; font-size: 9px; padding: 3px 5px;
  border-top: 2px solid #2f5597; }
.sched-wrap td.ar { unicode-bidi: plaintext; text-align: right; }
.sched-wrap td.num { text-align: center; white-space: nowrap; }
.sched-wrap td.ty { font-size: 7px; }
.sched-wrap td.id { white-space: nowrap; font-family: 'Courier New', monospace; font-size: 7px; }
.sched-wrap td.pred { font-size: 6px; word-break: break-all; line-height: 1.25; }
.sched-wrap td.clip { white-space: nowrap; text-overflow: ellipsis; }
.sched-wrap .chip { display: inline-block; min-width: 20px; padding: 0 3px; border-radius: 6px;
  background: #dde3ec; color: #4a5568; }
.sched-wrap .chip.crit { background: #e05a5a; color: #fff; font-weight: 700; }
.sched-note { direction: rtl; text-align: right; margin-top: 4px; font-size: 8px; color: #666; }
.sched-summary { direction: rtl; margin: 0 0 10px; padding: 8px 10px; border: 1px solid #d7dcE6;
  background: #f7f9fc; border-radius: 6px; font-size: 10px; }
/* nowrap: without it a value such as "22-Aug-26" broke across two lines and
   collided with the next label. */
.sched-summary .fact { display: inline-block; margin-left: 18px; margin-bottom: 2px;
  white-space: nowrap; }
.sched-summary .k { color: #6b7280; }
.sched-summary .v { font-weight: 700; margin-right: 5px; }
.gantt th.tick { font-size: 6px; padding: 1px 0; }
.gantt th.month { font-size: 7px; background: #1f3864; padding: 1px 2px; }
.gantt th.info-band { background: #1f3864; }
/* The bar area carries no vertical rules, so a run of painted cells reads as
   one continuous bar rather than a row of detached squares. */
.gantt td.cell { padding: 0; height: 12px; border-left: 0; border-right: 0; }
.gantt span.bar { display: block; height: 8px; margin: 2px 0 0; border-radius: 2px; }
.gantt span.ms { display: block; text-align: center; font-size: 9px; line-height: 12px; }
/* The info block is dense; a smaller face fits the dates and ids without clipping. */
.gantt td.info { font-size: 7px; }
.gantt td.info.id { font-size: 6.5px; }
.gantt-legend { margin-top: 6px; font-size: 9px; }
.gantt-legend .li { display: inline-block; margin-right: 18px; }
.gantt-legend i { display: inline-block; width: 14px; height: 8px; margin-right: 5px;
  vertical-align: middle; }
.gantt-legend .scale { color: #666; }
.sched-ref { direction: rtl; text-align: right; font-size: 11px; color: #4a5568;
  padding: 7px 10px; border-right: 3px solid #4f46e5; background: #f7f9fc; }
.sched-warn { direction: rtl; text-align: right; margin: 10px 0 0; padding: 8px 10px;
  border: 1px solid #f0c36d; background: #fdf6e3; border-radius: 6px; font-size: 10px; }
.sched-warn b { display: block; margin-bottom: 4px; }
.sched-warn li { margin: 1px 0; }
"""


def schedule_css():
	"""Stylesheet for the schedule block (exposed to Jinja via the `jinja` hook)."""
	return SCHEDULE_CSS


def build_schedule_html(doc, include_warnings=False):
	"""
	Render the full schedule block: summary, activity table, then Gantt chart.

	Returns an empty string when the tender has no schedule rows, so callers can
	fall back to whatever they showed before.
	"""
	rows = list(getattr(doc, "schedule_activities", None) or [])
	if not rows:
		return ""

	summary = build_summary_html(rows)
	table = build_activity_table_html(rows)
	gantt = build_gantt_html(rows)

	warn_html = ""
	if include_warnings:
		warnings = validate_schedule(rows)
		if warnings:
			items = "".join(f"<li>{_esc(w)}</li>" for w in warnings)
			warn_html = (
				f"<div class='sched-warn'><b>{_esc(_('Schedule consistency warnings'))}</b>"
				f"<ul>{items}</ul></div>"
			)

	return (
		"<div class='sched-wrap'>"
		f"{summary}"
		f"<h3>{_esc('الجدول الزمني الأساسي')}</h3>{table}"
		f"<h3 style='margin-top:16px'>{_esc('مخطط جانت')}</h3>{gantt}"
		f"{warn_html}"
		"</div>"
	)


def build_schedule_brief_html(doc):
	"""
	Compact schedule block for the portrait proposal: headline figures plus a
	pointer to the schedule document.

	The activity table and the Gantt need the long edge of an A3 sheet. Printing
	them into a 210mm portrait page clipped every column, so the full chart lives
	in its own landscape print format and the proposal carries the summary only.
	"""
	rows = list(getattr(doc, "schedule_activities", None) or [])
	if not rows:
		return ""

	return (
		"<div class='sched-wrap'>"
		f"{build_summary_html(rows)}"
		f"<div class='sched-ref'>{_esc('الجدول الزمني التفصيلي ومخطط جانت مرفقان في مستند مستقل: ')}"
		f"<b>{_esc('الجدول الزمني الأساسي للمشروع')}</b>."
		f"</div>"
		"</div>"
	)
