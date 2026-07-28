# Copyright (c) 2026, milind and contributors
# For license information, please see license.txt
"""
Critical Path Method scheduling over a working-day calendar.

The AI decides *what* the activities are, how long they take and how they link.
This module decides *when* they happen: a forward pass gives the earliest each
activity can start, a backward pass the latest it can start without pushing the
project end, and the difference is its total float. Zero float is the critical
path.

That arithmetic is why this exists. Asked to supply float and critical flags
directly, the model marked 87% of activities critical — it pattern-matches
importance rather than computing slack, and no prompt fixes that. Here the
numbers are derived, so they are correct by construction and identical on every
run.

Calendar semantics were verified against the reference Primavera P6 export:
  - `6D-8H` = six working days a week, Friday off.
  - An activity of duration D starting on S finishes on S + (D-1) working days.
  - FS with lag L: the successor starts L+1 working days after the predecessor
    finishes (so lag 0 means the next working day).
  - SS with lag L: the successor starts L working days after the predecessor
    starts.

Pure functions over plain data — no Frappe, no I/O — so it is unit-testable.
"""

from datetime import date, timedelta

# Python weekdays run Monday=0 … Sunday=6, so Friday is 4.
FRIDAY = 4
DEFAULT_OFF_DAYS = frozenset({FRIDAY})

RELATIONS = ("FS", "SS", "FF", "SF")


class ScheduleError(Exception):
	"""Raised when the activity network cannot be scheduled at all."""


# ---------------------------------------------------------------------------
# Working-day calendar
# ---------------------------------------------------------------------------
def is_working_day(day, off_days=DEFAULT_OFF_DAYS):
	return day.weekday() not in off_days


def next_working_day(day, off_days=DEFAULT_OFF_DAYS):
	"""The first working day on or after `day`."""
	while not is_working_day(day, off_days):
		day += timedelta(days=1)
	return day


def previous_working_day(day, off_days=DEFAULT_OFF_DAYS):
	"""The last working day on or before `day`."""
	while not is_working_day(day, off_days):
		day -= timedelta(days=1)
	return day


def add_working_days(day, count, off_days=DEFAULT_OFF_DAYS):
	"""Move `count` working days from `day` (negative moves backwards)."""
	day = next_working_day(day, off_days) if count >= 0 else previous_working_day(day, off_days)
	step = 1 if count >= 0 else -1
	remaining = abs(count)
	while remaining:
		day += timedelta(days=step)
		if is_working_day(day, off_days):
			remaining -= 1
	return day


def working_days_between(start, end, off_days=DEFAULT_OFF_DAYS):
	"""Signed count of working days from `start` to `end`."""
	if start == end:
		return 0
	sign, first, last = (1, start, end) if end > start else (-1, end, start)
	count = 0
	cursor = first
	while cursor < last:
		cursor += timedelta(days=1)
		if is_working_day(cursor, off_days):
			count += 1
	return sign * count


# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------
class Activity:
	"""One node in the network. `links` are incoming (predecessor) relations."""

	__slots__ = (
		"id", "duration", "links",
		"early_start", "early_finish", "late_start", "late_finish",
		"total_float", "is_critical",
	)

	def __init__(self, activity_id, duration, links=None):
		self.id = activity_id
		# Milestones are zero-duration; anything else takes at least a day.
		self.duration = max(0, int(duration or 0))
		self.links = list(links or [])
		self.early_start = None
		self.early_finish = None
		self.late_start = None
		self.late_finish = None
		self.total_float = 0
		self.is_critical = False


def _finish_from_start(start, duration, off_days):
	"""Duration D spans D working days inclusive of the start day."""
	if duration <= 1:
		return start
	return add_working_days(start, duration - 1, off_days)


def _start_from_finish(finish, duration, off_days):
	if duration <= 1:
		return finish
	return add_working_days(finish, -(duration - 1), off_days)


def _topological_order(activities):
	"""
	Kahn's algorithm over predecessor links.

	Returns (ordered_ids, cyclic_ids). Links pointing at unknown activities are
	ignored — the AI does occasionally invent a predecessor id, and dropping the
	link keeps the rest of the network schedulable.
	"""
	indegree = {}
	dependents = {aid: [] for aid in activities}
	for aid, activity in activities.items():
		known = [link for link in activity.links if link["id"] in activities and link["id"] != aid]
		indegree[aid] = len(known)
		for link in known:
			dependents[link["id"]].append(aid)

	queue = sorted(aid for aid, deg in indegree.items() if deg == 0)
	order = []
	while queue:
		current = queue.pop(0)
		order.append(current)
		for dependent in dependents[current]:
			indegree[dependent] -= 1
			if indegree[dependent] == 0:
				queue.append(dependent)
		queue.sort()

	cyclic = [aid for aid in activities if aid not in set(order)]
	return order, cyclic


def schedule_network(activities, project_start, off_days=DEFAULT_OFF_DAYS):
	"""
	Run the forward and backward passes over `activities`.

	`activities` maps activity_id -> Activity. Dates, float and criticality are
	written back onto each Activity. Returns a dict of diagnostics.
	"""
	if not activities:
		raise ScheduleError("No activities to schedule.")

	project_start = next_working_day(project_start, off_days)
	order, cyclic = _topological_order(activities)

	# A cycle cannot be scheduled. Rather than fail the whole run, the cyclic
	# activities are appended and treated as if they had no predecessors; the
	# caller surfaces them as a warning.
	order = order + cyclic

	dropped_links = []

	# --- forward pass: earliest possible dates -----------------------------
	for aid in order:
		activity = activities[aid]
		earliest = project_start
		earliest_finish = None

		for link in activity.links:
			pred = activities.get(link["id"])
			if pred is None:
				dropped_links.append((aid, link["id"]))
				continue
			if pred.early_start is None or aid in cyclic:
				# Predecessor not yet scheduled (only possible inside a cycle).
				continue

			rel, lag = link["rel"], int(link["lag"] or 0)
			if rel == "FS":
				candidate = add_working_days(pred.early_finish, lag + 1, off_days)
				earliest = max(earliest, candidate)
			elif rel == "SS":
				candidate = add_working_days(pred.early_start, lag, off_days)
				earliest = max(earliest, candidate)
			elif rel == "FF":
				candidate = add_working_days(pred.early_finish, lag, off_days)
				earliest_finish = candidate if earliest_finish is None else max(earliest_finish, candidate)
			elif rel == "SF":
				candidate = add_working_days(pred.early_start, lag, off_days)
				earliest_finish = candidate if earliest_finish is None else max(earliest_finish, candidate)

		if earliest_finish is not None:
			# A finish-constrained link can push the start later, never earlier.
			earliest = max(earliest, _start_from_finish(earliest_finish, activity.duration, off_days))

		activity.early_start = next_working_day(earliest, off_days)
		activity.early_finish = _finish_from_start(activity.early_start, activity.duration, off_days)

	project_finish = max(a.early_finish for a in activities.values())

	# --- backward pass: latest dates that do not delay the project ---------
	successors = {aid: [] for aid in activities}
	for aid, activity in activities.items():
		for link in activity.links:
			if link["id"] in activities:
				successors[link["id"]].append((aid, link["rel"], int(link["lag"] or 0)))

	for aid in reversed(order):
		activity = activities[aid]
		latest_finish = project_finish

		for succ_id, rel, lag in successors[aid]:
			succ = activities[succ_id]
			if succ.late_start is None:
				continue
			if rel == "FS":
				candidate = add_working_days(succ.late_start, -(lag + 1), off_days)
			elif rel == "SS":
				candidate = _finish_from_start(
					add_working_days(succ.late_start, -lag, off_days), activity.duration, off_days
				)
			elif rel == "FF":
				candidate = add_working_days(succ.late_finish, -lag, off_days)
			else:  # SF
				candidate = _finish_from_start(
					add_working_days(succ.late_finish, -lag, off_days), activity.duration, off_days
				)
			latest_finish = min(latest_finish, candidate)

		activity.late_finish = latest_finish
		activity.late_start = _start_from_finish(latest_finish, activity.duration, off_days)

	# --- float and criticality ---------------------------------------------
	for activity in activities.values():
		activity.total_float = working_days_between(
			activity.early_start, activity.late_start, off_days
		)
		activity.is_critical = activity.total_float <= 0

	return {
		"project_start": project_start,
		"project_finish": project_finish,
		"cyclic": cyclic,
		"dropped_links": dropped_links,
		"critical_count": sum(1 for a in activities.values() if a.is_critical),
	}
