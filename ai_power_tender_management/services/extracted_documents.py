"""Derived extraction-review rows for Tender Workspace.

This mirrors Smart Journal's pattern: source files stay in the upload table,
while AI/OCR outputs are written as separate, accountant/user-reviewable rows.
The helpers are intentionally tolerant so older sites without the new child
table keep working until migrated.
"""

from __future__ import annotations

import json

import frappe
from frappe.utils import cint, flt

EXTRACTED_DOCUMENTS_FIELD = "extracted_documents"


def has_review_table(doc) -> bool:
	meta = getattr(doc, "meta", None)
	if meta and hasattr(meta, "has_field"):
		return bool(meta.has_field(EXTRACTED_DOCUMENTS_FIELD))
	return hasattr(doc, EXTRACTED_DOCUMENTS_FIELD)


def clear_results(doc, source_row=None, extraction_type: str | None = None) -> int:
	"""Remove previous derived rows for the same source/type and return count."""
	if not has_review_table(doc):
		return 0

	source_row_name = _source_row_name(source_row)
	kept = []
	removed = 0
	for row in getattr(doc, EXTRACTED_DOCUMENTS_FIELD, []) or []:
		same_source = not source_row_name or getattr(row, "source_row", None) == source_row_name
		same_type = not extraction_type or getattr(row, "extraction_type", None) == extraction_type
		if same_source and same_type:
			removed += 1
			continue
		kept.append(row)
	doc.set(EXTRACTED_DOCUMENTS_FIELD, kept)
	return removed


def append_result(
	doc,
	source_row=None,
	extraction_type: str = "Other",
	title: str | None = None,
	extracted_text: str | None = None,
	status: str = "Extracted",
	confidence: float | None = None,
	error_log: str | None = None,
	page_number: str | int | None = None,
	row_count: int | None = None,
):
	"""Append one derived extraction row, if the review table exists."""
	if not has_review_table(doc):
		return None

	context = _source_context(source_row)
	payload = {
		"source_row": context["source_row"],
		"attachment": context["attachment"],
		"source_document": context["source_document"],
		"document_type": context["document_type"],
		"extraction_type": extraction_type or "Other",
		"title": (title or extraction_type or "Extraction")[:140],
		"status": status or "Extracted",
		"page_number": str(page_number or ""),
		"row_count": cint(row_count or 0),
		"extracted_text": extracted_text or "",
		"error_log": error_log or None,
	}
	if confidence is not None:
		payload["confidence"] = flt(confidence)
	return doc.append(EXTRACTED_DOCUMENTS_FIELD, payload)


def record_tender_info(doc, source_row, info: dict | None, filled, status: str, message: str, error_log=None):
	"""Record the tender-header extraction as one review row."""
	clear_results(doc, source_row, "Tender Info")
	text = {
		"filled": list(filled or []),
		"values": info or {},
		"message": message or "",
	}
	return append_result(
		doc,
		source_row,
		extraction_type="Tender Info",
		title="Tender Header Fields",
		extracted_text=_json_text(text),
		status=status,
		error_log=error_log,
		row_count=len(filled or []),
	)


def record_summary_rows(doc, source_row, rows, status: str, message: str, error_log=None):
	"""Record tender analysis rows as reviewable evidence rows."""
	clear_results(doc, source_row, "AI Summary")
	rows = list(rows or [])
	if not rows:
		return append_result(
			doc,
			source_row,
			extraction_type="AI Summary",
			title="Tender Analysis",
			extracted_text=message or "",
			status=status,
			error_log=error_log,
			row_count=0,
		)

	created = []
	for row in rows:
		title = row.get("summary_type") or "Tender Analysis"
		created.append(
			append_result(
				doc,
				source_row,
				extraction_type="AI Summary",
				title=title,
				extracted_text=row.get("extracted_text") or "",
				status=status,
				error_log=error_log,
				page_number=row.get("page_number"),
				row_count=1,
			)
		)
	return created


def record_boq_result(doc, source_row, rows, status: str, message: str, error_log=None):
	"""Record BOQ extraction as a compact review row."""
	clear_results(doc, source_row, "BOQ")
	rows = list(rows or [])
	preview = []
	for row in rows[:20]:
		preview.append({
			"item_no": _value(row, "item_no"),
			"description": _value(row, "description"),
			"unit": _value(row, "unit"),
			"quantity": flt(_value(row, "quantity")),
			"unit_price": flt(_value(row, "unit_price")),
			"total": flt(_value(row, "total")),
			"source_page": _value(row, "source_page"),
			"confidence": flt(_value(row, "extraction_confidence")),
		})
	text = {
		"message": message or "",
		"items_count": len(rows),
		"preview": preview,
	}
	return append_result(
		doc,
		source_row,
		extraction_type="BOQ",
		title="Bill of Quantities",
		extracted_text=_json_text(text),
		status=status,
		row_count=len(rows),
		error_log=error_log,
	)


def record_ocr_text(doc, source_row, text: str, status: str = "Extracted", error_log=None):
	"""Record a compact OCR evidence row without storing the full OCR body."""
	clear_results(doc, source_row, "OCR Text")
	body = (text or "").strip()
	snippet = body[:2000] + ("\n...[truncated]" if len(body) > 2000 else "")
	return append_result(
		doc,
		source_row,
		extraction_type="OCR Text",
		title="OCR Text",
		extracted_text=snippet,
		status=status,
		row_count=1 if body else 0,
		error_log=error_log,
	)


def _source_context(source_row):
	return {
		"source_row": _source_row_name(source_row),
		"attachment": _value(source_row, "file"),
		"source_document": _value(source_row, "file_name") or _value(source_row, "file"),
		"document_type": _value(source_row, "document_type"),
	}


def _source_row_name(source_row):
	return _value(source_row, "name")


def _value(obj, key):
	if obj is None:
		return ""
	if isinstance(obj, dict):
		return obj.get(key) or ""
	return getattr(obj, key, "") or ""


def _json_text(value) -> str:
	try:
		return json.dumps(value, ensure_ascii=False, indent=2)
	except Exception:
		return frappe.as_json(value)
