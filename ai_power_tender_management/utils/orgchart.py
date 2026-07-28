# Copyright (c) 2026, Raissyon and contributors
# For license information, please see license.txt
"""
Render the project organization structure: chart, staffing table, phase
allocation, and the escalation matrix.

The chart is drawn with nested tables and cell borders rather than SVG or
flexbox. wkhtmltopdf runs an old WebKit that ignores flexbox `gap` and renders
SVG unreliably, but it has always handled table borders — the same reason the
Gantt bars are colspan cells.
"""

import html

from frappe import _
from frappe.utils import cint

# Chart palette. Deliberately close to the reference structure document: a dark
# navy spine, teal for teams, and outlined white boxes for individual roles.
BOX_COLORS = {
	"Executive": ("#4a6b85", "#ffffff"),
	"Primary": ("#1f4e79", "#ffffff"),
	"Support": ("#2e5d70", "#ffffff"),
	"Team": ("#31859c", "#ffffff"),
	"Role": ("#ffffff", "#1f2430"),
	"Labour": ("#31859c", "#ffffff"),
}
LINE = "#7f9bc4"


def _esc(value):
	return html.escape(str(value or ""))


def _visible(doc, attr="show_in_chart"):
	rows = list(getattr(doc, "organization_roles", None) or [])
	return [r for r in rows if cint(getattr(r, attr, 1))]


def _by_tier(rows):
	"""Rows grouped into (tier, [rows]) ascending, preserving row order inside a tier."""
	tiers = {}
	for row in rows:
		tiers.setdefault(cint(getattr(row, "tier", 0)), []).append(row)
	return [(t, tiers[t]) for t in sorted(tiers)]


# ---------------------------------------------------------------------------
# The chart
# ---------------------------------------------------------------------------
def _box(row):
	style = (getattr(row, "box_style", "") or "Role")
	bg, fg = BOX_COLORS.get(style, BOX_COLORS["Role"])
	border = "#9db8cc" if style == "Role" else bg
	count = cint(getattr(row, "headcount", 0))
	badge = f"<span class='oc-n'>{count}</span>" if count > 1 else ""
	return (
		f"<div class='oc-box oc-{style.lower()}' "
		f"style='background:{bg};color:{fg};border-color:{border}'>"
		f"{_esc(getattr(row, 'role_title', ''))}{badge}</div>"
	)


def _connector(child_count):
	"""
	Drop from the parent centre, a horizontal bus, then a stub down to each child.

	Each child owns two half-width cells, so a border on the seam between them
	lands exactly on that child's centre line — the only way to place a vertical
	rule at a fractional position that old WebKit gets right.
	"""
	k = max(child_count, 1)
	cells = 2 * k

	# Drop: a single rule at the midpoint of the whole band.
	drop = "".join(
		f"<td class='v'></td>" if i == k - 1 else "<td></td>" for i in range(cells)
	)
	# Bus: spans the first child's centre to the last child's centre.
	bus = []
	for i in range(k):
		bus.append("<td class='h'></td>" if i > 0 else "<td></td>")      # left half
		bus.append("<td class='h'></td>" if i < k - 1 else "<td></td>")  # right half
	# Stubs: one rule per child centre.
	stub = "".join(("<td class='v'></td>" if h == 0 else "<td></td>") for _i in range(k) for h in (0, 1))

	return (
		"<table class='oc-conn'>"
		f"<tr class='drop'>{drop}</tr>"
		f"<tr class='bus'>{''.join(bus)}</tr>"
		f"<tr class='stub'>{stub}</tr>"
		"</table>"
	)


# A lone box stretched across the sheet reads as a banner rather than a node, so
# the spine of the chart is inset. Only a single box can be narrowed: with two or
# more, the centres must stay on the even divisions the connectors are drawn to.
_SOLO_BOX_WIDTH = 34.0

# Past this, boxes on an A4 page get narrower than a word of Arabic and the text
# stacks one letter-group per line. Wider tiers wrap onto further rows instead.
MAX_BOXES_PER_ROW = 6


def _chunk(rows):
	return [rows[i:i + MAX_BOXES_PER_ROW] for i in range(0, len(rows), MAX_BOXES_PER_ROW)]


def _row(rows):
	"""A single physical row of boxes, evenly divided."""
	if len(rows) == 1:
		pad = (100.0 - _SOLO_BOX_WIDTH) / 2
		cells = (
			f"<td style='width:{pad:.3f}%'></td>"
			f"<td style='width:{_SOLO_BOX_WIDTH:.3f}%'>{_box(rows[0])}</td>"
			f"<td style='width:{pad:.3f}%'></td>"
		)
	else:
		width = 100.0 / max(len(rows), 1)
		cells = "".join(f"<td style='width:{width:.3f}%'>{_box(r)}</td>" for r in rows)
	return f"<table class='oc-band'><tr>{cells}</tr></table>"


def _band(rows):
	"""One tier, wrapped over as many rows as it needs."""
	return "".join(_row(chunk) for chunk in _chunk(rows))


def _columns_band(parents, children):
	"""
	A tier whose rows hang off several different parents: each parent keeps its
	column and its children stack underneath it, as the reference chart does for
	the roles sitting under each team.
	"""
	by_parent = {}
	for child in children:
		by_parent.setdefault((getattr(child, "reports_to", "") or "").strip(), []).append(child)

	width = 100.0 / max(len(parents), 1)
	cells = []
	for parent in parents:
		code = (getattr(parent, "role_code", "") or "").strip()
		stack = "".join(_box(c) for c in by_parent.get(code, []))
		cells.append(f"<td style='width:{width:.3f}%'>{stack or '&nbsp;'}</td>")
	# Anything orphaned still prints rather than vanishing.
	leftovers = [c for key, group in by_parent.items()
	             if key not in {(getattr(p, "role_code", "") or "").strip() for p in parents}
	             for c in group]
	tail = _band(leftovers) if leftovers else ""
	return f"<table class='oc-band'><tr>{''.join(cells)}</tr></table>{tail}"


def _use_columns(previous, band):
	"""
	Whether this tier should sit in its parents' columns rather than in one row.

	Columns only read as columns when most of the tier above actually has
	children and the grid stays narrow. With twelve parents and two of them
	filled, the result was a near-empty row followed by the rest of the tier
	dumped underneath — worse than a plain band.
	"""
	if len(previous) < 2 or len(previous) > MAX_BOXES_PER_ROW:
		return False
	prev_codes = {(getattr(r, "role_code", "") or "").strip() for r in previous}
	filled = {(getattr(r, "reports_to", "") or "").strip() for r in band} & prev_codes
	return len(filled) >= 2 and len(filled) >= len(previous) * 0.6


def build_org_chart_html(doc):
	"""The organization chart itself."""
	rows = _visible(doc, "show_in_chart")
	if not rows:
		return ""

	tiers = _by_tier(rows)
	parts = []
	previous = None
	for _tier, band in tiers:
		if previous is not None:
			if _use_columns(previous, band):
				parts.append(_connector(len(previous)))
				parts.append(_columns_band(previous, band))
				previous = band
				continue
			# The bus feeds the first physical row; wrapped rows follow under it.
			parts.append(_connector(min(len(band), MAX_BOXES_PER_ROW)))
		parts.append(_band(band))
		previous = band

	return f"<div class='oc'>{''.join(parts)}</div>"


# ---------------------------------------------------------------------------
# Staffing table
# ---------------------------------------------------------------------------
def build_staffing_table_html(doc):
	"""Roles, headcount, basing, experience and responsibilities."""
	rows = _visible(doc, "show_in_table")
	if not rows:
		return ""

	head = "".join(
		f"<th style='width:{w}%'>{_esc(label)}</th>"
		for label, w in (
			("م", 4), ("الوظيفة", 20), ("العدد", 7), ("التواجد", 11),
			("الخبرة", 11), ("المسؤوليات الرئيسية", 47),
		)
	)

	body = []
	total = 0
	for i, row in enumerate(rows, start=1):
		count = cint(getattr(row, "headcount", 0))
		total += count
		# A blank count is a real answer for roles called off as needed.
		shown = str(count) if count else "حسب الحاجة"
		flag = " <span class='oc-req'>مطلوب تعاقدياً</span>" if cint(
			getattr(row, "mandated_by_tender", 0)) else ""
		body.append(
			"<tr>"
			f"<td class='c'>{i}</td>"
			f"<td class='ar b'>{_esc(getattr(row, 'role_title', ''))}{flag}</td>"
			f"<td class='c'>{_esc(shown)}</td>"
			f"<td class='c'>{_esc(getattr(row, 'location', ''))}</td>"
			f"<td class='c'>{_esc(getattr(row, 'experience', ''))}</td>"
			f"<td class='ar'>{_esc(getattr(row, 'responsibilities', ''))}</td>"
			"</tr>"
		)

	foot = (
		f"<div class='oc-total'>{_esc('إجمالي العمالة المقترحة:')} "
		f"<b>{total}</b> {_esc('فرداً')}</div>"
	) if total else ""

	return (
		f"<table class='oc-table'><thead><tr>{head}</tr></thead>"
		f"<tbody>{''.join(body)}</tbody></table>{foot}"
	)


# ---------------------------------------------------------------------------
# Phase allocation — derived from the schedule, not restated by hand
# ---------------------------------------------------------------------------
def _phase_groups(doc):
	"""(phase title, [activities]) in schedule order, keyed on the activity ID stem."""
	groups, order = {}, []
	for row in getattr(doc, "schedule_activities", None) or []:
		activity_id = (getattr(row, "activity_id", "") or "").strip()
		stem = activity_id.rsplit("-", 1)[0] if "-" in activity_id else activity_id
		if stem not in groups:
			groups[stem] = []
			order.append(stem)
		groups[stem].append(row)
	return [(stem, groups[stem]) for stem in order]


def _phase_title(activities):
	"""Read the phase name off its start milestone: 'بدء مرحلة X' -> 'X'."""
	for row in activities:
		if (getattr(row, "activity_type", "") or "") == "Start Milestone":
			name = (getattr(row, "activity_name", "") or "").strip()
			return name.replace("بدء مرحلة ", "").strip() or name
	return (getattr(activities[0], "activity_name", "") or "").strip()


def _phase_outputs(activities):
	for row in activities:
		if (getattr(row, "activity_type", "") or "") == "Finish Milestone":
			return (getattr(row, "activity_name", "") or "").strip()
	return ""


def build_phase_allocation_html(doc):
	"""Which team carries which phase, taken straight from the baseline schedule."""
	phases = _phase_groups(doc)
	if not phases:
		return ""

	headcount = {}
	for role in getattr(doc, "organization_roles", None) or []:
		title = (getattr(role, "role_title", "") or "").strip()
		if title:
			headcount[title] = headcount.get(title, 0) + cint(getattr(role, "headcount", 0))

	head = "".join(
		f"<th style='width:{w}%'>{_esc(label)}</th>"
		for label, w in (
			("المرحلة", 22), ("الفريق المسؤول", 30), ("العمالة الأساسية", 12), ("المخرجات", 36),
		)
	)

	body = []
	for _stem, activities in phases:
		counts = {}
		for row in activities:
			resource = (getattr(row, "primary_resource", "") or "").strip()
			if resource:
				counts[resource] = counts.get(resource, 0) + 1
		leaders = [r for r, _n in sorted(counts.items(), key=lambda kv: -kv[1])[:4]]
		# Only sum the roles we can actually match; an unmatched phase says so
		# rather than showing a number nobody can defend.
		people = sum(headcount.get(r, 0) for r in leaders)
		body.append(
			"<tr>"
			f"<td class='ar b'>{_esc(_phase_title(activities))}</td>"
			f"<td class='ar'>{_esc(' + '.join(leaders))}</td>"
			f"<td class='c'>{people or '—'}</td>"
			f"<td class='ar'>{_esc(_phase_outputs(activities))}</td>"
			"</tr>"
		)

	return f"<table class='oc-table'><thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table>"


# ---------------------------------------------------------------------------
# Escalation matrix
# ---------------------------------------------------------------------------
_ESCALATION_LABELS = {
	"Level 1": "المستوى الأول",
	"Level 2": "المستوى الثاني",
	"Level 3": "المستوى الثالث",
}


def build_escalation_html(doc):
	"""Who resolves what, and how quickly."""
	rows = [
		r for r in (getattr(doc, "organization_roles", None) or [])
		if (getattr(r, "escalation_level", "") or "").strip()
	]
	if not rows:
		return ""
	rows.sort(key=lambda r: (getattr(r, "escalation_level", "") or ""))

	head = "".join(
		f"<th style='width:{w}%'>{_esc(label)}</th>"
		for label, w in (
			("المستوى", 14), ("المسؤول", 24), ("نطاق المسؤولية", 46), ("زمن الاستجابة", 16),
		)
	)
	body = "".join(
		"<tr>"
		f"<td class='c b'>{_esc(_ESCALATION_LABELS.get((getattr(r, 'escalation_level', '') or '').strip(), ''))}</td>"
		f"<td class='ar b'>{_esc(getattr(r, 'role_title', ''))}</td>"
		f"<td class='ar'>{_esc(getattr(r, 'escalation_scope', ''))}</td>"
		f"<td class='c'>{_esc(getattr(r, 'escalation_response', ''))}</td>"
		"</tr>"
		for r in rows
	)
	return f"<table class='oc-table'><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def build_bullets_html(text):
	"""Free-text field, one bullet per line."""
	lines = [l.strip().lstrip("-•").strip() for l in str(text or "").splitlines()]
	lines = [l for l in lines if l]
	if not lines:
		return ""
	return "<ul class='oc-bullets'>" + "".join(f"<li>{_esc(l)}</li>" for l in lines) + "</ul>"


def has_organization(doc):
	"""True when there is anything to print."""
	return bool(getattr(doc, "organization_roles", None))


ORG_CSS = """
.oc { direction: rtl; text-align: center; margin: 6px 0 4px; }
.oc table { border-collapse: collapse; width: 100%; table-layout: fixed; }
.oc td { padding: 0; vertical-align: top; }
.oc-band td { padding: 0 3px; }
.oc-conn td { height: 9px; }
.oc-conn tr.bus td { height: 0; }
.oc-conn td.v { border-left: 1.5px solid __LINE__; }
.oc-conn td.h { border-top: 1.5px solid __LINE__; }
.oc-box { border: 1px solid; border-radius: 3px; padding: 4px 5px; font-size: 8px;
  line-height: 1.35; margin-bottom: 4px; }
.oc-box.oc-primary { font-size: 11px; font-weight: 700; padding: 7px 6px; }
.oc-box.oc-executive { font-size: 9px; font-weight: 700; }
.oc-box.oc-team, .oc-box.oc-support { font-weight: 700; font-size: 8.5px; }
.oc-n { display: inline-block; margin-right: 4px; padding: 0 4px; border-radius: 7px;
  background: rgba(255,255,255,.28); font-size: 7px; }
.oc-box.oc-role .oc-n { background: #e6ecf4; color: #1f4e79; }

.oc-table { width: 100%; border-collapse: collapse; direction: rtl; font-size: 9px;
  table-layout: fixed; margin-top: 4px; }
.oc-table th, .oc-table td { border: 1px solid #c8ccd6; padding: 3px 5px;
  vertical-align: top; }
.oc-table thead th { background: #1f3864; color: #fff; font-weight: 600; text-align: center; }
.oc-table tbody tr:nth-child(even) { background: #f4f7fc; }
.oc-table td.ar { text-align: right; unicode-bidi: plaintext; }
.oc-table td.c { text-align: center; }
.oc-table td.b { font-weight: 700; }
.oc-req { display: inline-block; margin-right: 5px; padding: 0 4px; border-radius: 6px;
  background: #fdeaea; color: #b03030; font-size: 7px; font-weight: 600; }
.oc-total { direction: rtl; text-align: left; margin-top: 5px; font-size: 9.5px;
  padding: 4px 8px; background: #eef2f8; border-right: 3px solid #1f4e79; }
.oc-bullets { direction: rtl; text-align: right; margin: 4px 18px 0 0; padding: 0;
  font-size: 10px; line-height: 1.75; }
.oc-bullets li { margin-bottom: 2px; }
""".replace("__LINE__", LINE)  # not %-formatting: the stylesheet is full of literal % widths


def org_css():
	"""Stylesheet for the organization block (exposed to Jinja via the `jinja` hook)."""
	return ORG_CSS
