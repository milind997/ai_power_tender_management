# Copyright (c) 2026, milind and contributors
# For license information, please see license.txt
"""
Whitelisted API for the Tender Upload / Tender Workspace page (Phase 1 MVP).

This layer intentionally contains PLACEHOLDER logic for the "AI" steps:
  - analyze_tender_document() creates stub AI Summary rows.
  - extract_boq() does best-effort digital extraction, falling back to sample rows.

Everything is structured so the real AI / OCR pipeline can be dropped in later
without changing the frontend contract. Search for "TODO(AI)" markers below.
"""

import io
import os

import frappe
from frappe import _
from frappe.utils import cint, flt
from frappe.utils.file_manager import save_file

from ai_power_tender_management.utils import ai_service, document_parser

# Placeholder text shown until the real AI extraction is connected.
PLACEHOLDER_TEXT = "سيتم استبدال هذا النص بنتائج تحليل الذكاء الاصطناعي في المرحلة التالية."

# Document types that represent the main tender / specifications document.
TENDER_DOC_TYPES = ("Tender Document", "Terms and Specifications")
# Document types that represent the BOQ / pricing sheet.
BOQ_DOC_TYPES = ("BOQ", "Purchase Requisition")

# How many placeholder rows to create per summary type on analyze.
SUMMARY_BLUEPRINT = {
	"Tender Summary": 1,
	"Scope of Work": 1,
	"Important Requirement": 1,
	"Dangerous Clause": 3,
	"Missing Information": 2,
	"Technical Requirement": 1,
	"Commercial Condition": 1,
	"Submission Instruction": 1,
	"Warranty Requirement": 1,
	"Penalty Clause": 1,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_doc(name):
	if not name:
		frappe.throw(_("Tender Workspace name is required."))
	return frappe.get_doc("Tender Workspace", name)


def _find_document(doc, document_types):
	"""Return the first uploaded document row matching one of document_types."""
	for row in doc.uploaded_documents:
		if row.document_type in document_types and row.file:
			return row
	return None


def _file_format_from_url(file_url):
	return (os.path.splitext(file_url or "")[1] or "").lstrip(".").lower()


# ---------------------------------------------------------------------------
# 1. Save (create or update) a Tender Workspace
# ---------------------------------------------------------------------------
@frappe.whitelist()
def save_tender_workspace(data):
	"""
	Create or update a Tender Workspace from basic info (+ optional documents).

	`data` is a JSON string / dict with the tender fields. If it contains a
	`name`, the existing record is updated; otherwise a new one is created.
	Optionally accepts a `documents` list to seed the uploaded_documents table.
	"""
	data = frappe.parse_json(data) if isinstance(data, str) else (data or {})

	name = data.get("name")
	if name and frappe.db.exists("Tender Workspace", name):
		doc = frappe.get_doc("Tender Workspace", name)
	else:
		doc = frappe.new_doc("Tender Workspace")

	basic_fields = [
		"tender_name", "tender_number", "client_name", "portal_source",
		"closing_date", "reviewer", "status", "notes", "boq_currency",
		"vat_rate",
	]
	for field in basic_fields:
		if field in data:
			doc.set(field, data.get(field))

	if not doc.tender_name:
		frappe.throw(_("Tender Name is required."))

	if not doc.status:
		doc.status = "Draft"

	# Optional: seed uploaded document references (id-less rows appended).
	for d in (data.get("documents") or []):
		doc.append("uploaded_documents", {
			"document_type": d.get("document_type") or "Other Attachment",
			"file": d.get("file") or d.get("file_url"),
			"file_name": d.get("file_name"),
			"file_format": d.get("file_format") or _file_format_from_url(d.get("file") or d.get("file_url")),
			"ai_status": d.get("ai_status") or "Uploaded",
			"readable_status": d.get("readable_status") or "Unknown",
		})

	doc.save()
	frappe.db.commit()

	return {
		"name": doc.name,
		"status": doc.status,
		"message": _("Tender saved successfully"),
	}


# ---------------------------------------------------------------------------
# 2. Read a Tender Workspace (with child tables)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_tender_workspace(name):
	"""Return the full Tender Workspace document including all child tables."""
	doc = _get_doc(name)
	return doc.as_dict()


# ---------------------------------------------------------------------------
# 3. Attach an uploaded file to the Tender Workspace
# ---------------------------------------------------------------------------
@frappe.whitelist()
def attach_tender_file(tender_workspace_name, document_type, file_url, file_name=None, file_format=None):
	"""
	Append an uploaded file to uploaded_documents and mark it as Uploaded.
	Returns the newly created document item row.
	"""
	doc = _get_doc(tender_workspace_name)

	row = doc.append("uploaded_documents", {
		"document_type": document_type or "Other Attachment",
		"file": file_url,
		"file_name": file_name or os.path.basename(file_url or ""),
		"file_format": (file_format or _file_format_from_url(file_url)).lower(),
		"ai_status": "Uploaded",
		"readable_status": "Unknown",
	})

	# Once at least one document is attached, reflect that in the tender status.
	if doc.status == "Draft":
		doc.status = "Documents Uploaded"

	doc.save()
	frappe.db.commit()

	return row.as_dict()


# ---------------------------------------------------------------------------
# 4. Analyze the tender document (PLACEHOLDER AI)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def analyze_tender_document(tender_workspace_name):
	"""
	Analyse the main Tender Document / Terms & Specifications file.

	Phase 1 behaviour:
	  - Digital PDFs: readable text -> create placeholder AI Summary rows.
	  - Non-readable / scanned PDFs: mark as "OCR Required" (no OCR performed).

	TODO(AI): replace the placeholder summary generation below with a call to
	the real LLM pipeline that consumes `document_parser.extract_text_from_pdf`.
	"""
	doc = _get_doc(tender_workspace_name)

	tender_doc = _find_document(doc, TENDER_DOC_TYPES)
	if not tender_doc:
		frappe.throw(_("Please upload Tender Document / Terms & Specifications first."))

	file_url = tender_doc.file
	file_format = (tender_doc.file_format or _file_format_from_url(file_url)).lower()
	source = tender_doc.file_name or tender_doc.file

	# Extract text once (PDF only). Non-PDF formats are treated as readable.
	document_text = document_parser.extract_text_from_pdf(file_url) if file_format == "pdf" else ""
	text_readable = (file_format != "pdf") or (
		len(document_text.strip()) > document_parser.READABLE_TEXT_THRESHOLD
	)

	ai_on = ai_service.is_enabled()

	# No text layer + AI + OCR available -> OCR→chunk→AI pipeline (background job).
	# This is the preferred path for scanned PDFs: cheaper and rate-limit friendly.
	if (not text_readable) and ai_on and file_format == "pdf" and document_parser.ocr_available():
		if tender_doc.ai_status == "Processing":
			# A run is already in flight — don't start a second (avoids conflicts).
			return {
				"status": "Processing",
				"dangerous_clauses_count": 0,
				"missing_information_count": 0,
				"message": _("Analysis is already running in the background. Please wait for it to finish."),
			}
		tender_doc.ai_status = "Processing"
		doc.save()
		frappe.db.commit()
		frappe.enqueue(
			"ai_power_tender_management.api.tender_workspace._ocr_analyze_pipeline",
			queue="long",
			timeout=1800,
			job_id=f"tender-ocr-analyze-{doc.name}",
			deduplicate=True,
			tender_workspace_name=doc.name,
			enqueue_after_commit=True,
		)
		return {
			"status": "Processing",
			"dangerous_clauses_count": 0,
			"missing_information_count": 0,
			"message": _(
				"Reading the scanned document with OCR + AI in the background. This can take a few "
				"minutes — the record will update automatically when it finishes."
			),
		}

	ai_rows = None
	vision_attempted = False

	if text_readable and ai_on:
		# Readable digital text -> feed the text to the LLM.
		ai_rows = _ai_summary_rows(doc, document_text)
	elif (not text_readable) and ai_on and file_format == "pdf" and ai_service.supports_pdf_vision():
		# No OCR available -> fall back to native PDF vision (may hit rate limits).
		vision_attempted = True
		ai_rows = _ai_summary_rows_pdf(doc, file_url)

	# Unreadable and no AI result -> OCR Required (logged for diagnosis).
	if (not text_readable) and not ai_rows:
		if vision_attempted:
			# The model was asked to read the PDF but failed (see the vision Error Log,
			# e.g. a rate-limit for a large document).
			log_title = "Tender Analyze: AI vision could not read PDF"
			user_msg = _(
				"AI could not read this PDF — it may be too large for the current AI rate limit "
				"(large documents must be processed in chunks). See the Error Log, then retry or raise the limit."
			)
		else:
			log_title = "Tender Analyze: OCR Required (no text layer)"
			user_msg = _(
				"This PDF has no readable text. Configure the AI Settings API key (vision) or use OCR."
			)
		frappe.log_error(
			title=log_title,
			message=(
				f"Tender: {doc.name}\n"
				f"File: {tender_doc.file_name} ({file_url})\n"
				f"Extracted text length: {len(document_text.strip())}\n"
				f"AI enabled: {ai_on} | PDF vision available: {ai_service.supports_pdf_vision()} | "
				f"vision attempted: {vision_attempted}\n\n"
				"The PDF has no extractable text layer (image/vector only). It needs AI vision "
				"(Anthropic) or OCR. Large PDFs may exceed the AI rate limit and must be chunked."
			),
		)
		tender_doc.ai_status = "OCR Required"
		tender_doc.readable_status = "OCR Required"
		tender_doc.ai_summary = user_msg
		doc.save()
		frappe.db.commit()
		return {
			"status": "OCR Required",
			"dangerous_clauses_count": 0,
			"missing_information_count": 0,
			"message": user_msg,
		}

	# (Re)generate summary rows for this source (from text, vision, or placeholder).
	doc.ai_summary = [r for r in doc.ai_summary if r.source_document != source]

	if ai_rows:
		for row in ai_rows:
			doc.append("ai_summary", {
				"summary_type": row.get("summary_type"),
				"extracted_text": row.get("extracted_text") or "",
				"source_document": source,
				"page_number": str(row.get("page_number") or ""),
				"confirmed": 0,
			})
	else:
		for summary_type, count in SUMMARY_BLUEPRINT.items():
			for i in range(count):
				doc.append("ai_summary", {
					"summary_type": summary_type,
					"extracted_text": PLACEHOLDER_TEXT,
					"source_document": source,
					"page_number": str(i + 1),
					"confirmed": 0,
				})

	tender_doc.ai_status = "Processed"
	tender_doc.readable_status = "Yes"
	tender_doc.ai_summary = (
		_("AI analysis complete.") if ai_rows
		else _("Placeholder analysis complete. Set the AI Settings API key for real AI results.")
	)
	doc.status = "AI Analyzed"
	doc.save()
	frappe.db.commit()

	dangerous = len([r for r in doc.ai_summary if r.summary_type == "Dangerous Clause"])
	missing = len([r for r in doc.ai_summary if r.summary_type == "Missing Information"])

	return {
		"status": "Processed",
		"dangerous_clauses_count": dangerous,
		"missing_information_count": missing,
		"message": _("Tender document analyzed successfully"),
	}


# ---------------------------------------------------------------------------
# 4b. Extract tender header info (key fields) from the main document
# ---------------------------------------------------------------------------
# Key fields the AI auto-fills on the Tender Workspace from the document.
_TENDER_TYPES = ("Supply", "Works", "Services", "Consultancy", "Other")


@frappe.whitelist()
def extract_tender_info(tender_workspace_name):
	"""
	Auto-fill the Tender Workspace key fields (name, number, client, type,
	location, closing date/time, bid bond, estimated value) from the uploaded
	tender document using the LLM.

	Uses digital text when available, then cached OCR text, then native PDF
	vision. Only fields the model returns are overwritten; blanks are left alone.
	"""
	doc = _get_doc(tender_workspace_name)

	tender_doc = _find_document(doc, TENDER_DOC_TYPES)
	if not tender_doc:
		frappe.throw(_("Please upload Tender Document / Terms & Specifications first."))

	if not ai_service.is_enabled():
		return {
			"status": "AI Not Configured",
			"filled": [],
			"message": _("AI Settings API key is not configured. Cannot extract tender info."),
		}

	file_url = tender_doc.file
	file_format = (tender_doc.file_format or _file_format_from_url(file_url)).lower()

	# 1) Digital text (or cached OCR text) -> text extraction.
	text = _best_tender_text(doc, tender_doc, file_format)
	info = _ai_tender_info(text) if text else None

	# 2) No usable text -> native PDF vision (Anthropic), when available.
	if not info and file_format == "pdf" and ai_service.supports_pdf_vision():
		info = _ai_tender_info_pdf(file_url)

	if not info:
		frappe.log_error(
			title="Tender Extract Info: no fields extracted",
			message=f"Tender: {doc.name}\nFile: {tender_doc.file_name} ({file_url})",
		)
		return {
			"status": "AI Failed",
			"filled": [],
			"message": _("Could not extract tender info from the document. See Error Log."),
		}

	filled = _apply_tender_info(doc, info)
	doc.save()
	frappe.db.commit()

	return {
		"status": "Extracted",
		"filled": filled,
		"message": _("Extracted {0} field(s) from the tender document.").format(len(filled)),
	}


def _best_tender_text(doc, tender_doc, file_format):
	"""Best available text for the tender doc: digital text, else cached OCR."""
	if file_format != "pdf":
		return ""
	text = document_parser.extract_text_from_pdf(tender_doc.file)
	if len(text.strip()) > document_parser.READABLE_TEXT_THRESHOLD:
		return text
	# Reuse OCR text cached by a previous analyze run, if any.
	return _read_ocr_cache(doc.name, tender_doc.name)


def _tender_info_schema():
	return (
		"{\"tender_name\": str, \"tender_number\": str, \"client_name\": str, "
		f"\"tender_type\": one of {list(_TENDER_TYPES)}, "
		"\"location\": city/region str, \"closing_date\": \"YYYY-MM-DD\" or empty, "
		"\"closing_time\": \"HH:MM\" 24h or empty, \"bid_bond_amount\": number or 0, "
		"\"estimated_value\": number or 0}"
	)


def _ai_tender_info(text):
	"""Ask the LLM to extract tender header fields from document text."""
	text = (text or "").strip()
	if len(text) < 100:
		return None
	system = (
		"You extract header/metadata fields from government tender documents "
		"(often Arabic). Respond ONLY with a valid JSON object, no prose."
	)
	prompt = (
		"From the tender document below, extract these fields as a single JSON "
		f"object: {_tender_info_schema()}. Use an empty string or 0 when a field "
		"is not present. Dates must be ISO format (YYYY-MM-DD).\n\n"
		f"DOCUMENT:\n{text[:_MAX_DOC_CHARS]}"
	)
	data = ai_service.complete_json(prompt, system=system)
	return data if isinstance(data, dict) else None


def _ai_tender_info_pdf(file_url):
	"""Extract tender header fields by reading the PDF natively (vision)."""
	system = (
		"You extract header/metadata fields from a scanned Arabic government "
		"tender PDF. Respond ONLY with a valid JSON object, no prose."
	)
	prompt = (
		"Read the attached tender PDF and extract these fields as a single JSON "
		f"object: {_tender_info_schema()}. Use an empty string or 0 when a field "
		"is not present. Dates must be ISO format (YYYY-MM-DD)."
	)
	data = ai_service.complete_pdf_json(file_url, prompt, system=system)
	return data if isinstance(data, dict) else None


def _apply_tender_info(doc, info):
	"""Set doc fields from an AI info dict; return the list of fields filled."""
	filled = []

	def _set(field, value):
		if value in (None, "", 0, "0"):
			return
		doc.set(field, value)
		filled.append(field)

	_set("tender_name", str(info.get("tender_name") or "").strip())
	_set("tender_number", str(info.get("tender_number") or "").strip())
	_set("client_name", str(info.get("client_name") or "").strip())
	_set("location", str(info.get("location") or "").strip())

	ttype = str(info.get("tender_type") or "").strip().title()
	if ttype in _TENDER_TYPES:
		_set("tender_type", ttype)

	if info.get("closing_date"):
		try:
			_set("closing_date", frappe.utils.getdate(info.get("closing_date")))
		except Exception:
			pass
	if info.get("closing_time"):
		try:
			_set("closing_time", frappe.utils.get_time(str(info.get("closing_time"))))
		except Exception:
			pass

	if flt(info.get("bid_bond_amount")):
		_set("bid_bond_amount", flt(info.get("bid_bond_amount")))
	if flt(info.get("estimated_value")):
		_set("estimated_value", flt(info.get("estimated_value")))

	return filled


# ---------------------------------------------------------------------------
# 5. Extract BOQ items
# ---------------------------------------------------------------------------
@frappe.whitelist()
def extract_boq(tender_workspace_name):
	"""
	Extract BOQ line items from the uploaded BOQ / Purchase Requisition file.

	Phase 1 behaviour:
	  - Excel (xls/xlsx/csv): best-effort row extraction via openpyxl.
	  - PDF: digital text check; if unreadable -> "OCR Required".
	  - If nothing reliable can be extracted -> sample placeholder rows.

	TODO(AI): replace the fallback sample rows with structured extraction from
	the AI pipeline once available.
	"""
	doc = _get_doc(tender_workspace_name)

	# BOQ is often embedded in the tender document (Saudi كراسة الشروط), so fall
	# back to the Tender Document when no dedicated BOQ file was uploaded.
	boq_doc = _find_document(doc, BOQ_DOC_TYPES) or _find_document(doc, TENDER_DOC_TYPES)
	if not boq_doc:
		frappe.throw(_("Please upload a BOQ or Tender Document first."))

	file_url = boq_doc.file
	file_format = (boq_doc.file_format or _file_format_from_url(file_url)).lower()

	rows = []
	status = "Extracted"

	if file_format in ("xlsx", "xls", "csv"):
		raw_rows = document_parser.extract_rows_from_excel(file_url)
		for r in raw_rows:
			if "raw" in r:
				# Header detection failed for this row; keep what we can.
				continue
			qty = flt(r.get("quantity"))
			price = flt(r.get("unit_price"))
			line_type = str(r.get("line_type") or "Item")
			if line_type not in ("Item", "Section Heading"):
				line_type = "Item"
			total = qty * price if line_type == "Item" else 0
			rows.append({
				"line_type": line_type,
				"item_no": str(r.get("item_no") or ""),
				"parent_item_no": str(r.get("parent_item_no") or ""),
				"description": str(r.get("description") or ""),
				"description_en": str(r.get("description_en") or ""),
				"unit": str(r.get("unit") or ""),
				"quantity": qty,
				"unit_price": price,
				"total": total,
				"specification": str(r.get("specification") or ""),
				"source_page": str(r.get("source_page") or ""),
				"extraction_confidence": flt(r.get("extraction_confidence")),
			})
	elif file_format == "pdf":
		boq_text = document_parser.extract_text_from_pdf(file_url)
		text_readable = len(boq_text.strip()) > document_parser.READABLE_TEXT_THRESHOLD

		if text_readable and ai_service.is_enabled():
			# Digital PDF -> extract items from the text via the LLM.
			ai_rows = _ai_boq_rows(boq_text)
			if ai_rows:
				rows = ai_rows
		elif (not text_readable) and ai_service.is_enabled() and document_parser.ocr_available():
			# No text layer -> OCR→AI BOQ pipeline in the background (preferred).
			if boq_doc.ai_status == "Processing":
				return {
					"status": "Processing",
					"items_count": 0,
					"message": _("BOQ extraction is already running in the background. Please wait."),
				}
			boq_doc.ai_status = "Processing"
			doc.save()
			frappe.db.commit()
			frappe.enqueue(
				"ai_power_tender_management.api.tender_workspace._ocr_boq_pipeline",
				queue="long",
				timeout=1800,
				job_id=f"tender-ocr-boq-{doc.name}",
				deduplicate=True,
				tender_workspace_name=doc.name,
				enqueue_after_commit=True,
			)
			return {
				"status": "Processing",
				"items_count": 0,
				"message": _(
					"Reading the BOQ with OCR + AI in the background. This can take a minute — the "
					"record will update automatically when it finishes."
				),
			}
		elif (not text_readable) and ai_service.supports_pdf_vision():
			# No OCR available -> read the PDF natively (vision).
			ai_rows = _ai_boq_rows_pdf(file_url)
			if ai_rows:
				rows = ai_rows

		# Still nothing and the PDF has no text layer -> OCR Required (logged).
		if not rows and not text_readable:
			frappe.log_error(
				title="Tender Extract BOQ: OCR Required (no text layer)",
				message=(
					f"Tender: {doc.name}\nFile: {boq_doc.file_name} ({file_url})\n"
					f"Extracted text length: {len(boq_text.strip())}\n"
					f"PDF vision available: {ai_service.supports_pdf_vision()}\n\n"
					"The BOQ PDF has no extractable text layer. Set the AI Settings API key "
					"(vision) to read it, or add OCR (Phase 2)."
				),
			)
			boq_doc.ai_status = "OCR Required"
			boq_doc.readable_status = "OCR Required"
			doc.save()
			frappe.db.commit()
			return {
				"status": "OCR Required",
				"items_count": 0,
				"message": _("This BOQ PDF has no readable text. Configure the AI Settings API key (vision) or use OCR."),
			}

	# Excel gave nothing but AI is on with a digital-text PDF handled above; nothing more to try here.

	# Nothing reliably extracted -> use placeholder sample rows so the flow works.
	if not rows:
		status = "Extracted"
		rows = _sample_boq_rows()

	# Replace existing BOQ items with the freshly extracted set.
	doc.set("boq_items", [])
	for r in rows:
		doc.append("boq_items", r)

	boq_doc.ai_status = "Extracted"
	boq_doc.readable_status = boq_doc.readable_status if boq_doc.readable_status == "OCR Required" else "Yes"
	doc.status = "BOQ Extracted"
	doc.save()
	frappe.db.commit()

	return {
		"status": status,
		"items_count": len(doc.boq_items),
		"message": _("BOQ extracted successfully"),
	}


def _sample_boq_rows():
	"""Placeholder BOQ rows used until real extraction is connected."""
	samples = [
		("1", "Water flow meter DN50", "Nos", 10, 1500),
		("2", "Water flow meter DN80", "Nos", 6, 2200),
		("3", "Installation & commissioning", "Lot", 1, 8000),
	]
	rows = []
	for item_no, desc, unit, qty, price in samples:
		rows.append({
			"line_type": "Item",
			"item_no": item_no,
			"parent_item_no": "",
			"description": desc,
			"description_en": desc,
			"unit": unit,
			"quantity": qty,
			"unit_price": price,
			"total": qty * price,
			"specification": PLACEHOLDER_TEXT,
			"source_page": "",
			"extraction_confidence": 0,
			"notes": _("Sample row (Phase 1 placeholder)"),
		})
	return rows


# ---------------------------------------------------------------------------
# 7. Generate proposal sections
# ---------------------------------------------------------------------------
# Ordered list of proposal sections generated for every tender.
PROPOSAL_SECTIONS = [
	"Scope Understanding",
	"Methodology",
	"Implementation Plan",
	"Primavera Style Timeline",
	"Equipment List",
	"Organization Chart",
	"QA/QC Plan",
	"HSE Plan",
	"Compliance Matrix",
	"Risk Summary",
]
PROPOSAL_SECTION_ALIASES = {
	"Primavera Timeline": "Primavera Style Timeline",
}

# Arabic placeholder content shown until the real AI generation is connected.
PLACEHOLDER_PROPOSAL_CONTENT = "سيتم إنشاء محتوى هذا القسم بواسطة الذكاء الاصطناعي في المرحلة التالية."

# Generate proposal text in small batches. Asking for all sections in one
# compact JSON response makes models compress each section too aggressively.
_PROPOSAL_BATCH_SIZE = 3
_PROPOSAL_BATCH_MAX_TOKENS = 3500
_PROPOSAL_SECTION_WORD_TARGET = "220-350"
PROPOSAL_SECTION_GUIDANCE = {
	"Scope Understanding": "project objective, scope boundaries, assumptions, deliverables, and client priorities",
	"Methodology": "execution approach, coordination, approvals, procurement, installation, testing, and handover",
	"Implementation Plan": "phases, responsibilities, dependencies, sequence of activities, and control points",
	"Primavera Style Timeline": "WBS-style milestones, activity durations, dependencies, and progress monitoring",
	"Equipment List": "equipment, tools, instruments, manpower resources, and mobilization readiness",
	"Organization Chart": "project governance, reporting lines, key roles, responsibilities, and escalation path",
	"QA/QC Plan": "ITP, inspections, material approvals, testing, nonconformance control, and records",
	"HSE Plan": "risk assessment, permits, PPE, emergency response, toolbox talks, and site housekeeping",
	"Compliance Matrix": "requirement-by-requirement compliance approach, evidence, responsibility, and remarks",
	"Risk Summary": "major technical, commercial, schedule, contractual, HSE, and compliance risks with mitigation actions",
}


def _normalize_proposal_section(section_type):
	"""Return the canonical proposal section name, accepting known UI aliases."""
	section = (section_type or "").strip()
	return PROPOSAL_SECTION_ALIASES.get(section, section)


def _order_proposal_sections(doc):
	"""Keep proposal child rows in the same order as the exported proposal."""
	order = {section: idx for idx, section in enumerate(PROPOSAL_SECTIONS)}
	doc.proposal_sections.sort(key=lambda row: order.get(row.section_type, len(order)))
	for idx, row in enumerate(doc.proposal_sections, start=1):
		row.idx = idx


@frappe.whitelist()
def generate_proposal_sections(tender_workspace_name):
	"""
	(Re)generate the standard proposal sections for the tender.

	When AI Settings are enabled, create detailed Arabic proposal text using
	the AI summary and BOQ context. Otherwise, create the same rows with
	placeholder Arabic content. Sets the tender status to "Proposal Drafted".
	"""
	doc = _get_doc(tender_workspace_name)

	# Ask the LLM (from AI Settings) for Arabic content per section when enabled.
	ai_enabled = ai_service.is_enabled()
	ai_map = _ai_proposal_map(doc) if ai_enabled else None

	# Regenerate from scratch so re-running is idempotent.
	doc.set("proposal_sections", [])
	generated_count = 0
	for section in PROPOSAL_SECTIONS:
		content = (ai_map or {}).get(section)
		generated = bool(content)
		if generated:
			generated_count += 1
		content = content or PLACEHOLDER_PROPOSAL_CONTENT
		doc.append("proposal_sections", {
			"section_type": section,
			"title": section,
			"status": "Generated" if generated else "Not Generated",
			"content": content,
			"confirmed": 0,
		})
	_order_proposal_sections(doc)

	doc.status = "Proposal Drafted"
	doc.save()
	frappe.db.commit()

	if generated_count == len(PROPOSAL_SECTIONS):
		status = "Generated"
		message = _("Proposal sections generated successfully")
	elif not ai_enabled:
		status = "AI Not Configured"
		message = _("AI Settings API key is not configured. Placeholder proposal rows were created.")
	elif generated_count:
		status = "Partial"
		message = _("Generated {0} of {1} proposal sections. Missing sections use placeholders; check Error Log.").format(
			generated_count, len(PROPOSAL_SECTIONS)
		)
	else:
		status = "AI Failed"
		message = _("AI could not generate proposal sections. Placeholder rows were created; check Error Log.")

	return {
		"status": status,
		"sections_count": len(doc.proposal_sections),
		"generated_count": generated_count,
		"message": message,
	}


@frappe.whitelist(methods=["POST"])
def generate_proposal_section(tender_workspace_name: str, section_type: str):
	"""Generate or refresh one proposal section row without touching the others."""
	doc = _get_doc(tender_workspace_name)
	section = _normalize_proposal_section(section_type)
	if section not in PROPOSAL_SECTIONS:
		frappe.throw(_("Unknown proposal section: {0}").format(section_type))

	ai_enabled = ai_service.is_enabled()
	ai_map = _ai_proposal_map(doc, sections=[section]) if ai_enabled else None
	content = (ai_map or {}).get(section)
	generated = bool(content)
	content = content or PLACEHOLDER_PROPOSAL_CONTENT

	target = None
	for row in doc.proposal_sections:
		if row.section_type == section:
			target = row
			break
	if not target:
		target = doc.append("proposal_sections", {})

	target.section_type = section
	target.title = section
	target.status = "Generated" if generated else "Not Generated"
	target.content = content
	target.confirmed = 0

	_order_proposal_sections(doc)
	doc.status = "Proposal Drafted"
	doc.save()
	frappe.db.commit()

	if generated:
		status = "Generated"
		message = _("Proposal section generated: {0}").format(section)
	elif not ai_enabled:
		status = "AI Not Configured"
		message = _("AI Settings API key is not configured. Placeholder was created for: {0}").format(section)
	else:
		status = "AI Failed"
		message = _("AI could not generate {0}. Placeholder was created; check Error Log.").format(section)

	return {
		"status": status,
		"section_type": section,
		"generated": generated,
		"message": message,
	}


# ---------------------------------------------------------------------------
# 8. Export technical proposal (PLACEHOLDER)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def export_technical_proposal(tender_workspace_name):
	"""
	Generate the technical proposal as a self-contained, print-ready RTL HTML
	document built from `proposal_sections`, attach it to the tender, and return
	its file_url.

	HTML (not PDF) is used because it renders Arabic reliably in any browser and
	needs no server-side PDF engine; the user can Print → Save as PDF.

	TODO(export): when a PDF engine (wkhtmltopdf / weasyprint) is available,
	convert this same HTML via `frappe.utils.pdf.get_pdf` and save a .pdf instead.
	"""
	doc = _get_doc(tender_workspace_name)

	if not doc.proposal_sections:
		frappe.throw(_("Please Generate Proposal Sections first."))

	html = _build_technical_html(doc)
	filename = f"Technical-Proposal-{doc.name}.html"
	file_url = _save_export(filename, html, doc.name)

	return {
		"status": "Ready",
		"sections_count": len(doc.proposal_sections),
		"file_url": file_url,
		"message": _("Technical proposal generated ({0} sections).").format(len(doc.proposal_sections)),
	}


# ---------------------------------------------------------------------------
# 9. Export financial proposal (PLACEHOLDER)
# ---------------------------------------------------------------------------
@frappe.whitelist()
def export_financial_proposal(tender_workspace_name):
	"""
	Generate the financial proposal as a real XLSX priced-BOQ workbook built
	from `boq_items` (via openpyxl), attach it to the tender, and return its
	file_url. Includes a grand-total row.
	"""
	doc = _get_doc(tender_workspace_name)

	if not doc.boq_items:
		frappe.throw(_("Please Extract BOQ first."))

	content, grand_total = _build_financial_xlsx(doc)
	filename = f"Financial-Proposal-{doc.name}.xlsx"
	file_url = _save_export(filename, content, doc.name)

	return {
		"status": "Ready",
		"items_count": len(doc.boq_items),
		"grand_total": grand_total,
		"file_url": file_url,
		"message": _("Financial proposal generated ({0} items).").format(len(doc.boq_items)),
	}


# ---------------------------------------------------------------------------
# Export helpers
# ---------------------------------------------------------------------------
def _save_export(filename, content, tender_name):
	"""Attach a generated export file to the tender and return its file_url.

	Re-running an export replaces the previous file with the same name so the
	attachment list does not grow on every click.
	"""
	# Frappe may append a random suffix to the stored file_name on disk
	# collisions (e.g. "...-TND-00002ab12cd.xlsx"), so match by prefix and scope
	# strictly to this tender's attachments.
	base = filename.rsplit(".", 1)[0]
	existing = frappe.get_all(
		"File",
		filters={
			"attached_to_doctype": "Tender Workspace",
			"attached_to_name": tender_name,
			"file_name": ["like", f"{base}%"],
		},
		pluck="name",
	)
	for name in existing:
		frappe.delete_doc("File", name, ignore_permissions=True, force=True)

	_file = save_file(filename, content, "Tender Workspace", tender_name, is_private=1)
	return _file.file_url


def _build_technical_html(doc):
	"""Build a styled, print-ready RTL Arabic HTML technical proposal."""
	esc = frappe.utils.escape_html

	meta = [
		(_("Tender"), doc.tender_name),
		(_("Tender No"), doc.tender_number),
		(_("Client"), doc.client_name),
		(_("Closing Date"), frappe.utils.formatdate(doc.closing_date) if doc.closing_date else ""),
	]
	meta_html = "".join(
		f"<div class='meta-row'><span class='meta-label'>{esc(label)}</span>"
		f"<span class='meta-value'>{esc(value or '—')}</span></div>"
		for label, value in meta
	)

	sections_html = ""
	for i, s in enumerate(doc.proposal_sections, start=1):
		# `content` comes from a Text Editor field -> already HTML, do not escape.
		sections_html += (
			f"<section class='sec'>"
			f"<h2>{i}. {esc(s.title or s.section_type)}</h2>"
			f"<div class='content'>{s.content or ''}</div>"
			f"</section>"
		)

	return f"""<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>{esc(_('Technical Proposal'))} — {esc(doc.tender_name or doc.name)}</title>
<style>
	* {{ box-sizing: border-box; }}
	body {{ font-family: 'Tahoma','Segoe UI','Arial',sans-serif; color: #1f2430; margin: 0; padding: 32px 40px; line-height: 1.7; }}
	.cover {{ background: linear-gradient(120deg,#4f46e5,#7c3aed); color:#fff; border-radius: 14px; padding: 28px 30px; margin-bottom: 26px; }}
	.cover h1 {{ margin: 0 0 6px; font-size: 26px; }}
	.cover .subtitle {{ opacity: .85; font-size: 14px; }}
	.meta {{ margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }}
	.meta-row {{ display: flex; gap: 8px; font-size: 13px; }}
	.meta-label {{ opacity: .8; min-width: 90px; }}
	.meta-value {{ font-weight: 600; }}
	.sec {{ margin-bottom: 22px; padding: 18px 20px; border: 1px solid #e6e8ee; border-radius: 12px; page-break-inside: avoid; }}
	.sec h2 {{ margin: 0 0 10px; font-size: 17px; color: #4f46e5; border-bottom: 2px solid #eef0f6; padding-bottom: 8px; }}
	.content {{ font-size: 14px; }}
	@media print {{ body {{ padding: 0; }} .sec {{ break-inside: avoid; }} }}
</style>
</head>
<body>
	<div class="cover">
		<h1>{esc(_('Technical Proposal'))}</h1>
		<div class="subtitle">{esc(doc.tender_name or '')}</div>
		<div class="meta">{meta_html}</div>
	</div>
	{sections_html}
</body>
</html>"""


def _build_financial_xlsx(doc):
	"""Build a priced-BOQ XLSX workbook; return (bytes, grand_total)."""
	import openpyxl
	from openpyxl.styles import Alignment, Font, PatternFill

	wb = openpyxl.Workbook()
	ws = wb.active
	ws.title = "Financial Proposal"

	# Title row
	ws["A1"] = f"Financial Proposal — {doc.tender_name or doc.name}"
	ws["A1"].font = Font(size=14, bold=True)
	ws.merge_cells("A1:J1")

	headers = [
		"Line Type", "Item No", "Parent Item No", "Description", "Description (English)",
		"Unit", "Quantity", "Unit Price", "Total", "Specification",
	]
	header_row = 3
	ws.append([])  # row 2 spacer
	ws.append(headers)
	header_fill = PatternFill("solid", fgColor="4F46E5")
	for col in range(1, len(headers) + 1):
		cell = ws.cell(row=header_row, column=col)
		cell.font = Font(color="FFFFFF", bold=True)
		cell.fill = header_fill
		cell.alignment = Alignment(horizontal="center")

	subtotal = 0.0
	for row in doc.boq_items:
		is_heading = (row.line_type or "Item") == "Section Heading"
		total = 0 if is_heading else flt(row.quantity) * flt(row.unit_price)
		subtotal += total
		ws.append([
			row.line_type or "Item",
			row.item_no,
			row.parent_item_no,
			row.description,
			row.description_en,
			row.unit,
			0 if is_heading else flt(row.quantity),
			0 if is_heading else flt(row.unit_price),
			total,
			row.specification,
		])

	vat_rate = flt(doc.vat_rate if doc.vat_rate is not None else 15)
	vat_amount = subtotal * vat_rate / 100
	grand_total = subtotal + vat_amount

	for label, amount in (
		("Subtotal", subtotal),
		(f"VAT ({vat_rate:g}%)", vat_amount),
		("Grand Total", grand_total),
	):
		ws.append(["", "", "", "", "", "", "", label, amount, ""])
	last = ws.max_row
	for row_idx in range(last - 2, last + 1):
		ws.cell(row=row_idx, column=8).font = Font(bold=True)
		ws.cell(row=row_idx, column=9).font = Font(bold=True)

	# Column widths
	for col, width in zip("ABCDEFGHIJ", [14, 12, 14, 42, 42, 10, 12, 14, 14, 30]):
		ws.column_dimensions[col].width = width

	buf = io.BytesIO()
	wb.save(buf)
	return buf.getvalue(), grand_total


# ---------------------------------------------------------------------------
# 6. Processing summary
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_processing_summary(tender_workspace_name):
	"""Return a compact status/counts summary for the processing result card."""
	doc = _get_doc(tender_workspace_name)

	tender_doc = _find_document(doc, TENDER_DOC_TYPES)
	boq_doc = _find_document(doc, BOQ_DOC_TYPES)

	dangerous = len([r for r in doc.ai_summary if r.summary_type == "Dangerous Clause"])
	missing = len([r for r in doc.ai_summary if r.summary_type == "Missing Information"])

	return {
		"tender_status": doc.status,
		"tender_document_status": tender_doc.ai_status if tender_doc else "Not Uploaded",
		"boq_status": boq_doc.ai_status if boq_doc else "Not Uploaded",
		"ai_summary_count": len(doc.ai_summary),
		"dangerous_clauses_count": dangerous,
		"missing_information_count": missing,
		"boq_items_count": len(doc.boq_items),
		"proposal_sections_count": len(doc.proposal_sections),
		"tender_summary_created": any(r.summary_type == "Tender Summary" for r in doc.ai_summary),
		"ai_enabled": ai_service.is_enabled(),
	}


# ---------------------------------------------------------------------------
# LLM helpers — build prompts, call the model (via AI Settings), parse output.
# Each returns None on any problem so callers fall back to placeholders.
# ---------------------------------------------------------------------------
# Truncate very large documents before sending to the LLM (context safety).
_MAX_DOC_CHARS = 12000
_SUMMARY_TYPES = list(SUMMARY_BLUEPRINT.keys())


def _ai_summary_rows(doc, document_text):
	"""Ask the LLM to extract structured tender-summary rows from the text."""
	text = (document_text or "").strip()
	if len(text) < 100:
		return None

	system = (
		"You are a tender analyst. Extract structured insights from tender "
		"documents. Respond ONLY with valid JSON, no prose."
	)
	prompt = (
		"From the tender document below, extract insights as a JSON array. "
		"Each element: {\"summary_type\": one of "
		f"{_SUMMARY_TYPES}, \"extracted_text\": short finding, "
		"\"page_number\": string or empty}. Include several Dangerous Clause and "
		"Missing Information items when present.\n\n"
		f"DOCUMENT:\n{text[:_MAX_DOC_CHARS]}"
	)
	data = ai_service.complete_json(prompt, system=system)
	if not isinstance(data, list):
		return None

	rows = []
	for item in data:
		if not isinstance(item, dict):
			continue
		stype = item.get("summary_type")
		if stype in _SUMMARY_TYPES and item.get("extracted_text"):
			rows.append(item)
	return rows or None


def _ai_boq_rows(boq_text):
	"""Ask the LLM to extract BOQ line items from raw text."""
	text = (boq_text or "").strip()
	if len(text) < 50:
		return None

	system = "You extract Bill of Quantities line items. Respond ONLY with valid JSON."
	prompt = (
		"Extract the BOQ line items from the text below as a JSON array. Each "
		"element: {\"line_type\": \"Item\" or \"Section Heading\", "
		"\"item_no\": str, \"parent_item_no\": str, \"description\": str, "
		"\"description_en\": English translation if useful, \"unit\": str, "
		"\"quantity\": number, \"unit_price\": number, \"specification\": str, "
		"\"source_page\": str, \"extraction_confidence\": 0-100}. For headings "
		"or subtotal/VAT lines, set line_type to \"Section Heading\" and quantity/unit_price to 0.\n\n"
		f"BOQ TEXT:\n{text[:_MAX_DOC_CHARS]}"
	)
	data = ai_service.complete_json(prompt, system=system)
	if not isinstance(data, list):
		return None

	rows = []
	for item in data:
		if not isinstance(item, dict) or not item.get("description"):
			continue
		qty = flt(item.get("quantity"))
		price = flt(item.get("unit_price"))
		line_type = str(item.get("line_type") or "Item")
		if line_type not in ("Item", "Section Heading"):
			line_type = "Item"
		total = qty * price if line_type == "Item" else 0
		rows.append({
			"line_type": line_type,
			"item_no": str(item.get("item_no") or ""),
			"parent_item_no": str(item.get("parent_item_no") or ""),
			"description": str(item.get("description") or ""),
			"description_en": str(item.get("description_en") or ""),
			"unit": str(item.get("unit") or ""),
			"quantity": qty,
			"unit_price": price,
			"total": total,
			"specification": str(item.get("specification") or ""),
			"source_page": str(item.get("source_page") or ""),
			"extraction_confidence": flt(item.get("extraction_confidence")),
		})
	return rows or None


def _proposal_generation_context(doc):
	"""Build compact tender context for detailed proposal section generation."""
	context_lines = [
		f"Tender: {doc.tender_name or ''}",
		f"Tender No: {doc.tender_number or ''}",
		f"Client: {doc.client_name or ''}",
	]

	summary_rows = [r for r in getattr(doc, "ai_summary", []) if getattr(r, "extracted_text", None)]
	if summary_rows:
		context_lines.append("\nAI SUMMARY:")
	for r in summary_rows[:30]:
		page = f" (page {r.page_number})" if getattr(r, "page_number", None) else ""
		context_lines.append(f"- {r.summary_type}{page}: {r.extracted_text}")

	boq_rows = [r for r in getattr(doc, "boq_items", []) if getattr(r, "description", None)]
	if boq_rows:
		context_lines.append("\nBOQ ITEMS:")
	for r in boq_rows[:30]:
		line_type = getattr(r, "line_type", None) or "Item"
		parent = f", parent {r.parent_item_no}" if getattr(r, "parent_item_no", None) else ""
		quantity = f", qty {r.quantity}" if getattr(r, "quantity", None) else ""
		unit = f" {r.unit}" if getattr(r, "unit", None) else ""
		total = f", total {r.total}" if getattr(r, "total", None) else ""
		spec = f", spec: {r.specification}" if getattr(r, "specification", None) else ""
		context_lines.append(f"- [{line_type}] {r.item_no or ''}{parent} {r.description}{quantity}{unit}{total}{spec}")

	return "\n".join(context_lines)[:_MAX_DOC_CHARS]


def _ai_proposal_map(doc, sections=None):
	"""Ask the LLM for detailed Arabic proposal content keyed by section name."""
	context = _proposal_generation_context(doc)
	sections = [
		_normalize_proposal_section(section)
		for section in (sections or PROPOSAL_SECTIONS)
		if _normalize_proposal_section(section) in PROPOSAL_SECTIONS
	]
	if not sections:
		return None

	system = (
		"You are a senior technical proposal writer for government and utility "
		"tenders in Saudi Arabia. Write formal Arabic. Respond ONLY with valid JSON."
	)

	result = {}
	for start in range(0, len(sections), _PROPOSAL_BATCH_SIZE):
		batch = sections[start : start + _PROPOSAL_BATCH_SIZE]
		section_list = "\n".join(f"- {section}" for section in batch)
		guidance = "\n".join(
			f"- {section}: {PROPOSAL_SECTION_GUIDANCE.get(section, '')}"
			for section in batch
		)
		prompt = (
			"Write detailed Arabic technical proposal content for EACH section "
			f"listed below. Target {_PROPOSAL_SECTION_WORD_TARGET} Arabic words per "
			"section. Use tender-specific details from the context where available; "
			"where the context is missing, state practical assumptions without "
			"claiming unsupported facts. Return short HTML fragments only, using "
			"<p>, <ul>, <li>, and <table> where useful. Do not return Markdown, code "
			"fences, or a full HTML document. Return a valid JSON object mapping each "
			"exact English section name to its Arabic HTML content string.\n\n"
			f"SECTIONS:\n{section_list}\n\n"
			f"SECTION GUIDANCE:\n{guidance}\n\n"
			f"TENDER CONTEXT:\n{context}"
		)
		data = ai_service.complete_json(
			prompt,
			system=system,
			max_tokens=_PROPOSAL_BATCH_MAX_TOKENS,
		)
		if not isinstance(data, dict):
			continue

		for section in batch:
			content = data.get(section)
			if content:
				result[section] = str(content).strip()

	return result or None


# ---------------------------------------------------------------------------
# Vision helpers — for PDFs with no text layer (scanned/image). Send the PDF
# natively to the model (Anthropic) instead of extracted text.
# ---------------------------------------------------------------------------
def _ai_summary_rows_pdf(doc, file_url):
	"""Extract structured tender-summary rows by reading the PDF natively."""
	system = (
		"You are a tender analyst reading a scanned Arabic tender document (كراسة الشروط). "
		"Extract structured insights. Respond ONLY with valid JSON, no prose."
	)
	prompt = (
		"Read the attached tender PDF and extract insights as a JSON array. Each element: "
		"{\"summary_type\": one of "
		f"{_SUMMARY_TYPES}, \"extracted_text\": short finding (Arabic ok), "
		"\"page_number\": string}. Include several Dangerous Clause (penalties, "
		"guarantees) and Missing Information items when present."
	)
	data = ai_service.complete_pdf_json(file_url, prompt, system=system)
	if not isinstance(data, list):
		return None

	rows = []
	for item in data:
		if isinstance(item, dict) and item.get("summary_type") in _SUMMARY_TYPES and item.get("extracted_text"):
			rows.append(item)
	return rows or None


def _ai_boq_rows_pdf(file_url):
	"""Extract BOQ line items by reading the PDF natively (vision)."""
	system = "You extract Bill of Quantities line items from a scanned PDF. Respond ONLY with valid JSON."
	prompt = (
		"Read the attached tender PDF and find the BOQ / quantities table "
		"(جدول الكميات والأسعار). Return the line items as a JSON array. Each element: "
		"{\"line_type\": \"Item\" or \"Section Heading\", \"item_no\": str, "
		"\"parent_item_no\": str, \"description\": str, \"description_en\": English "
		"translation if useful, \"unit\": str, \"quantity\": number, \"unit_price\": number, "
		"\"specification\": str, \"source_page\": str, \"extraction_confidence\": 0-100}. "
		"If prices are absent (unpriced BOQ), set unit_price to 0. For headings or "
		"subtotal/VAT lines, set line_type to \"Section Heading\" and quantity/unit_price to 0."
	)
	data = ai_service.complete_pdf_json(file_url, prompt, system=system)
	if not isinstance(data, list):
		return None

	rows = []
	for item in data:
		if not isinstance(item, dict) or not item.get("description"):
			continue
		qty = flt(item.get("quantity"))
		price = flt(item.get("unit_price"))
		line_type = str(item.get("line_type") or "Item")
		if line_type not in ("Item", "Section Heading"):
			line_type = "Item"
		total = qty * price if line_type == "Item" else 0
		rows.append({
			"line_type": line_type,
			"item_no": str(item.get("item_no") or ""),
			"parent_item_no": str(item.get("parent_item_no") or ""),
			"description": str(item.get("description") or ""),
			"description_en": str(item.get("description_en") or ""),
			"unit": str(item.get("unit") or ""),
			"quantity": qty,
			"unit_price": price,
			"total": total,
			"specification": str(item.get("specification") or ""),
			"source_page": str(item.get("source_page") or ""),
			"extraction_confidence": flt(item.get("extraction_confidence")),
		})
	return rows or None


# ---------------------------------------------------------------------------
# OCR pipeline (background) — for scanned PDFs with no text layer.
#   OCR the PDF locally -> chunk the text -> send chunks to the LLM (throttled
#   under the rate limit) -> aggregate structured rows. Runs via frappe.enqueue.
# ---------------------------------------------------------------------------
# Chars per chunk (~3k tokens) — small enough to stay under the per-minute limit.
_CHUNK_CHARS = 12000
# Keywords that mark the BOQ / quantities pages in the OCR text.
_BOQ_MARKERS = ("جدول الكميات", "الكمية", "وصف البند", "BOQ", "FLOW METER", "QUANTITY", "UNIT PRICE")


def _chunk_text(text, max_chars=_CHUNK_CHARS):
	"""Split text into chunks of at most max_chars, breaking on page boundaries."""
	text = text or ""
	if len(text) <= max_chars:
		return [text] if text.strip() else []

	chunks, current = [], ""
	for block in text.split("\n\n"):
		if len(current) + len(block) + 2 > max_chars and current:
			chunks.append(current)
			current = ""
		if len(block) > max_chars:
			for i in range(0, len(block), max_chars):
				chunks.append(block[i : i + max_chars])
			continue
		current += ("\n\n" if current else "") + block
	if current.strip():
		chunks.append(current)
	return chunks


def _publish(name, message, progress, reload=False):
	"""Push OCR/AI progress to any open Tender Workspace form."""
	frappe.publish_realtime(
		"tender_analyze_progress",
		{"name": name, "message": message, "progress": progress, "reload": reload},
		doctype="Tender Workspace",
		docname=name,
	)


# ---------------------------------------------------------------------------
# OCR text cache (file-based)
#   OCR is expensive (minutes), so the extracted text is cached. It is kept as
#   a private .txt File attached to the tender — NOT in a child-table field —
#   so the (large) text is never loaded on every `frappe.get_doc(...)` read.
#   The cache is loaded lazily, only inside the background pipeline.
# ---------------------------------------------------------------------------
def _ocr_cache_filename(td_name):
	return f"ocr-cache-{td_name}.txt"


def _read_ocr_cache(tender_name, td_name):
	"""Return cached OCR text for a tender document row, or '' if not cached."""
	names = frappe.get_all(
		"File",
		filters={
			"attached_to_doctype": "Tender Workspace",
			"attached_to_name": tender_name,
			"file_name": _ocr_cache_filename(td_name),
		},
		pluck="name",
	)
	if not names:
		return ""
	try:
		content = frappe.get_doc("File", names[0]).get_content()
		if isinstance(content, bytes):
			content = content.decode("utf-8", errors="ignore")
		return content or ""
	except Exception:
		return ""


def _write_ocr_cache(tender_name, td_name, text):
	"""Cache OCR text as a private .txt file attached to the tender.

	Replaces any previous cache file for this document so re-runs don't pile up.
	"""
	filename = _ocr_cache_filename(td_name)
	existing = frappe.get_all(
		"File",
		filters={
			"attached_to_doctype": "Tender Workspace",
			"attached_to_name": tender_name,
			"file_name": filename,
		},
		pluck="name",
	)
	for name in existing:
		frappe.delete_doc("File", name, ignore_permissions=True, force=True)
	save_file(filename, (text or "").encode("utf-8"), "Tender Workspace", tender_name, is_private=1)


def _ocr_analyze_pipeline(tender_workspace_name):
	"""
	Background: OCR the tender document, then summarise it chunk-by-chunk.

	Concurrency note: the `doc` object is NOT held across the multi-minute AI
	loop. OCR text is cached to a private .txt File (not a child field); the doc
	is reloaded fresh immediately before the child-table mutation + save to avoid
	stale-save ("record changed") conflicts.
	"""
	doc = _get_doc(tender_workspace_name)
	tender_doc = _find_document(doc, TENDER_DOC_TYPES)
	if not tender_doc:
		return

	file_url = tender_doc.file
	source = tender_doc.file_name or file_url
	td_name = tender_doc.name

	try:
		_publish(doc.name, _("Running OCR on the document…"), 10)

		# 1) OCR (reuse the file cache). The text lives in a private .txt File,
		#    not on the doc, so it never bloats normal reads.
		ocr_text = _read_ocr_cache(doc.name, td_name)
		if len(ocr_text.strip()) < 100:
			ocr_text = document_parser.ocr_pdf_text(file_url)
			_write_ocr_cache(doc.name, td_name, ocr_text)
			frappe.db.commit()

		if len(ocr_text.strip()) < 100:
			frappe.db.set_value("Tender Document Item", td_name, {
				"ai_status": "OCR Required", "readable_status": "OCR Required",
				"ai_summary": _("OCR produced no readable text from this document."),
			}, update_modified=False)
			frappe.db.commit()
			frappe.log_error(title="Tender OCR pipeline: empty OCR", message=f"{doc.name} / {file_url}")
			_publish(doc.name, _("OCR produced no text."), 100, reload=True)
			return

		# 2) Chunk + summarise (throttled). No DB writes inside the loop.
		chunks = _chunk_text(ocr_text)
		collected = []
		for idx, chunk in enumerate(chunks):
			rows = _ai_summary_rows(doc, chunk)
			if rows:
				collected.extend(rows)
			ai_service.throttle(ai_service.estimate_tokens(chunk))
			pct = 40 + int(50 * (idx + 1) / max(1, len(chunks)))
			_publish(doc.name, _("Analysed section {0}/{1}").format(idx + 1, len(chunks)), pct)

		# 3) Reload fresh, then persist rows (dedupe near-identical findings).
		doc = frappe.get_doc("Tender Workspace", tender_workspace_name)
		tender_doc = _find_document(doc, TENDER_DOC_TYPES)
		doc.ai_summary = [r for r in doc.ai_summary if r.source_document != source]
		seen = set()
		for row in collected:
			key = (row.get("summary_type"), (row.get("extracted_text") or "")[:60])
			if key in seen:
				continue
			seen.add(key)
			doc.append("ai_summary", {
				"summary_type": row.get("summary_type"),
				"extracted_text": row.get("extracted_text") or "",
				"source_document": source,
				"page_number": str(row.get("page_number") or ""),
				"confirmed": 0,
			})

		if tender_doc:
			tender_doc.ai_status = "Processed"
			tender_doc.readable_status = "Yes"
			tender_doc.ai_summary = _("AI analysis complete (OCR + AI).")
		doc.status = "AI Analyzed"
		doc.save()
		frappe.db.commit()
		_publish(doc.name, _("Analysis complete."), 100, reload=True)
	except Exception:
		frappe.db.rollback()
		frappe.log_error(title="Tender OCR analyze pipeline failed", message=frappe.get_traceback())
		frappe.db.set_value("Tender Document Item", td_name, "ai_status", "Failed", update_modified=False)
		frappe.db.commit()
		_publish(tender_workspace_name, _("Analysis failed — see Error Log."), 100, reload=True)


def _ocr_boq_pipeline(tender_workspace_name):
	"""Background: OCR the BOQ document and extract line items from the table pages."""
	doc = _get_doc(tender_workspace_name)
	boq_doc = _find_document(doc, BOQ_DOC_TYPES)
	if not boq_doc:
		return

	file_url = boq_doc.file
	boq_name = boq_doc.name
	try:
		_publish(doc.name, _("Running OCR on the BOQ…"), 15)

		# OCR per page so we can target only the BOQ / quantities pages.
		pages = document_parser.ocr_pdf_pages(file_url)
		if not any(t.strip() for _, t in pages):
			frappe.db.set_value("Tender Document Item", boq_name, {
				"ai_status": "OCR Required", "readable_status": "OCR Required",
			}, update_modified=False)
			frappe.db.commit()
			frappe.log_error(title="Tender OCR BOQ: empty OCR", message=f"{doc.name} / {file_url}")
			_publish(doc.name, _("OCR produced no text."), 100, reload=True)
			return

		boq_pages = [t for _, t in pages if any(m in t for m in _BOQ_MARKERS)]
		boq_text = "\n\n".join(boq_pages) if boq_pages else "\n\n".join(t for _, t in pages)

		_publish(doc.name, _("Extracting BOQ items…"), 60)
		rows = _ai_boq_rows(boq_text[: _CHUNK_CHARS * 2]) or []

		if not rows:
			frappe.db.set_value("Tender Document Item", boq_name, {
				"ai_status": "OCR Required", "readable_status": "OCR Required",
			}, update_modified=False)
			frappe.db.commit()
			_publish(doc.name, _("Could not extract BOQ items."), 100, reload=True)
			return

		# Reload fresh before mutating the child table + saving.
		doc = frappe.get_doc("Tender Workspace", tender_workspace_name)
		boq_doc = _find_document(doc, BOQ_DOC_TYPES)
		doc.set("boq_items", [])
		for r in rows:
			doc.append("boq_items", r)
		if boq_doc:
			boq_doc.ai_status = "Extracted"
			boq_doc.readable_status = "Yes"
		doc.status = "BOQ Extracted"
		doc.save()
		frappe.db.commit()
		_publish(doc.name, _("BOQ extracted ({0} items).").format(len(rows)), 100, reload=True)
	except Exception:
		frappe.db.rollback()
		frappe.log_error(title="Tender OCR BOQ pipeline failed", message=frappe.get_traceback())
		frappe.db.set_value("Tender Document Item", boq_name, "ai_status", "Failed", update_modified=False)
		frappe.db.commit()
		_publish(tender_workspace_name, _("BOQ extraction failed — see Error Log."), 100, reload=True)
