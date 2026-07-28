import frappe

# Section keys that older releases stored for the timeline proposal section.
OLD_SECTION_TYPES = ("Primavera Style Timeline", "Primavera Timeline")
NEW_SECTION_TYPE = "Project Timeline"
NEW_TITLE_AR = "الجدول الزمني للمشروع"


def execute():
	"""Drop the Primavera brand name from stored proposal sections.

	`section_type` is the canonical key used for ordering and guidance lookups,
	so rows left on the old value would stop matching after the rename.
	"""
	if not frappe.db.table_exists("Tender Proposal Section"):
		return

	frappe.db.sql(
		"""
		UPDATE `tabTender Proposal Section`
		SET section_type = %(new)s
		WHERE section_type IN %(old)s
		""",
		{"new": NEW_SECTION_TYPE, "old": OLD_SECTION_TYPES},
	)

	# Displayed titles are free text; only rewrite the ones carrying the brand.
	frappe.db.sql(
		"""
		UPDATE `tabTender Proposal Section`
		SET title = %(title)s
		WHERE title LIKE '%%بريمافيرا%%' OR title LIKE '%%Primavera%%'
		""",
		{"title": NEW_TITLE_AR},
	)
