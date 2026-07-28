# Tender Upload — Phase 1 MVP

Adds a Tender Workspace / upload flow on the existing desk page **`/app/tender-upload`**.
No new app, no ERPNext core changes. Real AI and OCR are **not** implemented — the
backend ships clean placeholders/stubs marked with `TODO(AI)`.

## Files created / updated

### Frontend (existing page, upgraded — not replaced)
- `ai_power_tender_management/ai_power_tender_management/page/tender_upload/tender_upload.js`
  - Header summary card (Tender / Client / Tender No / Closing Date / Status)
  - Visual 6-step indicator (Upload Documents = active)
  - Tender Basic Info form (native Frappe controls)
  - Three upload cards: Tender Document, BOQ / Purchase Requisition, Other Attachments
  - Action bar: Save Tender · Analyze Tender Document · Extract BOQ · Next: AI Summary
  - Supported-files rules box + Processing Result card
  - Status badges, drag-and-drop + click-to-browse, loading states, toasts

### Backend
- **DocTypes** (module `ai_power_tender_management`)
  - `Tender Workspace` (parent) — basic info + 3 child tables
  - `Tender Document Item` (child) — uploaded files + `ai_status` / `readable_status`
  - `Tender AI Summary` (child) — extracted clauses/requirements
  - `Tender BOQ Item` (child) — BOQ line items
  - `Tender Proposal Section` (child) — generated Arabic proposal sections
    (Scope Understanding, Methodology, Implementation Plan, Project Timeline,
    Equipment List, Organization Chart, QA/QC Plan, HSE Plan,
    Compliance Matrix)
- **DocType form buttons** — `doctype/tender_workspace/tender_workspace.js` adds
  a toolbar with: Analyze Tender Document · Extract BOQ · Generate Proposal
  Sections (group **Tender Actions**) and Export Technical Proposal · Export
  Financial Proposal (group **Export**).
- **API** `ai_power_tender_management/api/tender_workspace.py` (whitelisted)
  - `save_tender_workspace(data)`
  - `get_tender_workspace(name)`
  - `attach_tender_file(tender_workspace_name, document_type, file_url, file_name, file_format)`
  - `analyze_tender_document(tender_workspace_name)` — placeholder AI summary rows
  - `extract_boq(tender_workspace_name)` — Excel via openpyxl, else sample rows
  - `generate_proposal_sections(tender_workspace_name)` — 9 placeholder Arabic sections
  - `export_technical_proposal(tender_workspace_name)` — generates a print-ready
    **RTL HTML** proposal from `proposal_sections`, attached to the tender; returns
    `file_url`. (HTML because no server PDF engine is installed — see note below.)
  - `export_financial_proposal(tender_workspace_name)` — generates a real **XLSX**
    priced BOQ (openpyxl) with a grand-total row, attached to the tender; returns
    `file_url` + `grand_total`.
  - Re-running an export replaces the tender's previous file of that type (no
    attachment build-up). The frontend opens `file_url` in a new tab to download.

  > PDF note: `wkhtmltopdf` / `weasyprint` are not installed in this environment,
  > so the technical proposal is emitted as self-contained RTL HTML (renders
  > Arabic reliably; use browser Print → Save as PDF). To switch to server-side
  > PDF later, install wkhtmltopdf and run the same HTML through
  > `frappe.utils.pdf.get_pdf` — the `TODO(export)` marker shows where.
  - `get_processing_summary(tender_workspace_name)`
- **LLM access** `ai_power_tender_management/utils/ai_service.py`
  - Reads provider / model / api_key / base_url / max_tokens / timeout from the
    **AI Settings** Single DocType (from the `smart_journal` app) — nothing is
    hardcoded. Supports Anthropic and OpenAI-compatible providers.
  - `is_enabled()` requires both `enabled` **and** a stored API key.
  - `complete()` / `complete_json()` call the configured model and fail soft
    (return None → callers use placeholders).
  - Wired into `analyze_tender_document` (structured summary rows), `extract_boq`
    (BOQ line items from PDF text), and `generate_proposal_sections` (Arabic
    content). When AI is disabled/unconfigured, all three fall back to placeholders.
  - **To activate:** open **AI Settings**, keep *Enabled* on, and set the *API Key*
    (currently empty → placeholders are used). Provider/model are already set to
    Anthropic / `claude-sonnet-4-6` there.
- **Helper** `ai_power_tender_management/utils/document_parser.py`
  - `extract_text_from_pdf(file_url)` — pypdf, PyMuPDF fallback
  - `is_pdf_text_readable(file_url)` — True when text length > 100
  - `extract_rows_from_excel(file_url)` — openpyxl, best-effort column mapping
  - `ocr_pdf_pages` / `ocr_pdf_text` — Tesseract OCR (ara+eng) for scanned/image
    PDFs with no text layer (renders pages via PyMuPDF → pytesseract)

### Scanned-PDF OCR pipeline (background)
For PDFs with **no text layer** (image/vector only — common for Saudi tender
كراسة الشروط), a background pipeline runs: **OCR locally → chunk the text →
send chunks to the LLM (throttled under the rate limit) → aggregate rows.**
- `analyze_tender_document` / `extract_boq` detect the missing text layer and
  `frappe.enqueue` `_ocr_analyze_pipeline` / `_ocr_boq_pipeline` (queue `long`),
  returning `status: "Processing"` immediately.
- OCR text is cached on `Tender Document Item.ocr_text` to avoid re-OCR.
- `ai_service.throttle()` paces requests under `RATE_LIMIT_TPM` (8k, under the
  org's 10k input-tokens/min); the Anthropic SDK also retries 429 with backoff.
- Progress is pushed via `frappe.publish_realtime("tender_analyze_progress")`;
  the DocType form reloads on completion and the desk page polls
  `get_processing_summary`.
- **Prereqs:** Tesseract + `tesseract-lang` (Arabic) and `pytesseract` installed;
  background workers running.
- Order of preference for scanned PDFs: **OCR pipeline** (cheap, chunkable) →
  native PDF **vision** (if OCR unavailable) → **OCR Required** (logged).

## Behaviour notes
- A PDF that yields no digital text → `ai_status = OCR Required` (no OCR performed).
- Analyze on a readable doc creates 13 placeholder summary rows
  (incl. 3 Dangerous Clause, 2 Missing Information) and sets status `AI Analyzed`.
- Extract BOQ reads Excel rows; if none reliable, inserts sample rows and sets
  status `BOQ Extracted`.
- Placeholder extraction text:
  `سيتم استبدال هذا النص بنتائج تحليل الذكاء الاصطناعي في المرحلة التالية.`

## How to test
1. Open **`/app/tender-upload`** (hard-refresh once: Cmd/Ctrl+Shift+R).
2. Fill Tender Basic Info (Tender Name required) → **Save Tender** (toast + record name in title).
3. Drag/drop or browse a file into each card. Files link to the tender on save/attach.
4. **Analyze Tender Document** → status + Processing Result card update.
5. **Extract BOQ** → BOQ item count shown.
6. Inspect the saved record in **Tender Workspace** list to see child tables.

## Where AI plugs in later (search `TODO(AI)`)
- `analyze_tender_document` → replace placeholder summary rows with LLM output over
  `document_parser.extract_text_from_pdf`.
- `extract_boq` → replace sample rows with structured extraction (PDF tables / AI).
