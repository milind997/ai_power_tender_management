# Copyright (c) 2026, milind and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class TenderWorkspace(Document):
	def validate(self):
		subtotal = 0
		unpriced = []
		for row in self.boq_items:
			# Fallback heading detection: a titled row with no unit and no
			# quantity is a section header, not a priceable line item. This
			# catches headings that the extraction/AI missed to tag.
			if (row.line_type or "Item") != "Section Heading" and _looks_like_heading(row):
				row.line_type = "Section Heading"

			if (row.line_type or "Item") == "Section Heading":
				row.total = 0
				continue
			row.total = flt(row.quantity) * flt(row.unit_price)
			subtotal += flt(row.total)
			if flt(row.quantity) > 0 and flt(row.unit_price) == 0:
				unpriced.append(row.idx)

		self.boq_currency = self.boq_currency or "SAR"
		self.vat_rate = flt(self.vat_rate if self.vat_rate is not None else 15)
		self.boq_subtotal = subtotal
		self.vat_amount = subtotal * flt(self.vat_rate) / 100
		self.boq_grand_total = subtotal + flt(self.vat_amount)

		# Don't let a half-priced BOQ be marked as final.
		if self.status == "Submitted" and unpriced:
			frappe.throw(
				_("Cannot submit: {0} BOQ item(s) have a quantity but no unit price (rows {1}).").format(
					len(unpriced), ", ".join(str(i) for i in unpriced)
				)
			)


def _looks_like_heading(row):
	"""Heuristic: a described row with no unit and zero quantity is a heading."""
	has_description = bool((row.description or "").strip())
	has_unit = bool((row.unit or "").strip())
	return has_description and not has_unit and flt(row.quantity) == 0
