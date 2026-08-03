// Copyright (c) 2026, milind and contributors
// For license information, please see license.txt

const TENDER_WORKSPACE_STYLE_ID = "tender-workspace-style";
const TENDER_ROW_STATE_CLASSES = [
	"tender-row-danger",
	"tender-row-missing",
	"tender-row-confirmed",
	"tender-row-unpriced",
	"tender-row-heading",
	"tender-row-failed",
	"tender-row-processing",
	"tender-row-processed",
	"tender-row-ocr",
].join(" ");

function setup_tender_workspace_visuals(frm) {
	inject_tender_workspace_styles();
	if (frm.wrapper) $(frm.wrapper).addClass("tender-workspace-form");
	if (frm.page && frm.page.wrapper) $(frm.page.wrapper).addClass("tender-workspace-page");
}

function inject_tender_workspace_styles() {
	if (document.getElementById(TENDER_WORKSPACE_STYLE_ID)) return;

	const control = (fname) =>
		[
			`.tender-workspace-form .frappe-control[data-fieldname="${fname}"] input`,
			`.tender-workspace-form .frappe-control[data-fieldname="${fname}"] textarea`,
			`.tender-workspace-form .frappe-control[data-fieldname="${fname}"] .control-value`,
			`.tender-workspace-form .frappe-control[data-fieldname="${fname}"] .static-area`,
		].join(",");
	const grid = (table, fname) =>
		[
			`.tender-workspace-form .frappe-control[data-fieldname="${table}"] [data-fieldname="${fname}"]`,
			`.tender-workspace-form .frappe-control[data-fieldname="${table}"] [data-fieldname="${fname}"] input`,
			`.tender-workspace-form .frappe-control[data-fieldname="${table}"] [data-fieldname="${fname}"] textarea`,
			`.tender-workspace-form .frappe-control[data-fieldname="${table}"] [data-fieldname="${fname}"] .static-area`,
		].join(",");
	const plaintext_selectors = [
		control("tender_name"),
		control("tender_name_ar"),
		control("client_name"),
		control("location"),
		control("notes"),
		control("org_purpose"),
		control("org_basis"),
		control("org_notes"),
		grid("uploaded_documents", "file_name"),
		grid("uploaded_documents", "ai_summary"),
		grid("ai_summary", "extracted_text"),
		grid("ai_summary", "source_document"),
		grid("boq_items", "description"),
		grid("boq_items", "description_en"),
		grid("boq_items", "specification"),
		grid("boq_items", "notes"),
	].join(",");

	const style = document.createElement("style");
	style.id = TENDER_WORKSPACE_STYLE_ID;
	style.textContent = `
		.tender-workspace-form {
			--tender-surface: var(--card-bg, var(--fg-color, #fff));
			--tender-soft: var(--control-bg, #f8fafc);
			--tender-ink: var(--text-color, #1f2937);
			--tender-muted: var(--text-muted, #6b7280);
			--tender-border: var(--border-color, #dfe3e8);
			--tender-blue: var(--blue-600, #2563eb);
			--tender-green: var(--green-600, #059669);
			--tender-orange: var(--orange-500, #f97316);
			--tender-red: var(--red-500, #e53e3e);
		}
		.tender-workspace-form .form-dashboard {
			margin-bottom: 14px;
		}
		.tender-desk-dashboard {
			margin: 2px 0 12px;
			color: var(--tender-ink);
		}
		.tender-health-dashboard {
			border: 1px solid var(--tender-border);
			border-radius: 8px;
			background: var(--tender-surface);
			box-shadow: 0 8px 24px rgba(15, 23, 42, .06);
			overflow: hidden;
		}
		.tender-health-header {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 12px;
			align-items: start;
			padding: 14px 16px;
			border-bottom: 1px solid var(--tender-border);
			background: var(--tender-surface);
		}
		.tender-health-title {
			min-width: 0;
		}
		.tender-kicker,
		.tender-health-label {
			display: block;
			font-size: 11px;
			line-height: 1.2;
			font-weight: 700;
			letter-spacing: 0;
			text-transform: uppercase;
			color: var(--tender-muted);
		}
		.tender-health-title strong {
			display: block;
			margin-top: 3px;
			font-size: 18px;
			line-height: 1.25;
			font-weight: 700;
			overflow-wrap: anywhere;
			unicode-bidi: plaintext;
			text-align: start;
		}
		.tender-health-subtitle {
			margin-top: 3px;
			font-size: 12px;
			color: var(--tender-muted);
			unicode-bidi: plaintext;
			text-align: start;
		}
		.tender-health-status {
			display: flex;
			flex-direction: column;
			gap: 6px;
			align-items: flex-end;
			min-width: 180px;
		}
		.tender-preview-trigger {
			width: 100%;
			min-height: 32px;
			border-radius: 6px;
			font-weight: 700;
		}
		.tender-preview-trigger .icon {
			stroke: currentColor;
		}
		.tender-readiness-pill,
		.tender-deadline-pill,
		.tender-status-chip {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-height: 30px;
			padding: 5px 12px;
			border-radius: 999px;
			border: 1px solid var(--tender-border);
			background: var(--tender-soft);
			color: var(--tender-ink);
			font-size: 12px;
			font-weight: 700;
			white-space: nowrap;
		}
		.tender-readiness-pill,
		.tender-deadline-pill {
			border-color: var(--tender-health-border, var(--tender-border));
			background: var(--tender-health-bg, var(--tender-soft));
			color: var(--tender-health-color, var(--tender-ink));
		}
		.tender-readiness-pill {
			font-size: 13px;
			min-height: 32px;
		}
		.tender-deadline-pill {
			font-size: 11px;
			min-height: 26px;
			padding: 4px 10px;
		}
		.tender-health-neutral {
			--tender-health-color: var(--gray-700, #374151);
			--tender-health-border: var(--gray-200, #e5e7eb);
			--tender-health-bg: var(--gray-50, #f9fafb);
		}
		.tender-health-info {
			--tender-health-color: var(--blue-700, #1d4ed8);
			--tender-health-border: var(--blue-200, #bfdbfe);
			--tender-health-bg: var(--blue-50, #eff6ff);
		}
		.tender-health-success {
			--tender-health-color: var(--green-700, #047857);
			--tender-health-border: var(--green-200, #a7f3d0);
			--tender-health-bg: var(--green-50, #ecfdf5);
		}
		.tender-health-warning {
			--tender-health-color: var(--orange-700, #c2410c);
			--tender-health-border: var(--orange-200, #fed7aa);
			--tender-health-bg: var(--orange-50, #fff7ed);
		}
		.tender-health-danger {
			--tender-health-color: var(--red-700, #c53030);
			--tender-health-border: var(--red-200, #fed7d7);
			--tender-health-bg: var(--red-50, #fff5f5);
		}
		.tender-status-reviewed,
		.tender-status-submitted,
		.tender-status-proposal-drafted {
			border-color: var(--green-200, #a7f3d0);
			background: var(--green-50, #ecfdf5);
			color: var(--green-700, #047857);
		}
		.tender-status-ai-analyzed,
		.tender-status-boq-extracted,
		.tender-status-documents-uploaded {
			border-color: var(--blue-200, #bfdbfe);
			background: var(--blue-50, #eff6ff);
			color: var(--blue-700, #1d4ed8);
		}
		.tender-health-body {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(280px, .75fr);
		}
		.tender-health-metrics {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			border-inline-end: 1px solid var(--tender-border);
		}
		.tender-health-metric {
			position: relative;
			min-height: 86px;
			padding: 12px 12px 10px 14px;
			border-inline-end: 1px solid var(--tender-border);
			border-bottom: 1px solid var(--tender-border);
			overflow: hidden;
		}
		.tender-health-metric:nth-child(3n) {
			border-inline-end: 0;
		}
		.tender-health-metric:nth-last-child(-n + 3) {
			border-bottom: 0;
		}
		.tender-health-metric:before {
			content: "";
			position: absolute;
			inset-block: 0;
			inset-inline-start: 0;
			width: 4px;
			background: var(--tender-card-color, var(--tender-blue));
		}
		.tender-card-neutral {
			--tender-card-color: var(--gray-500, #64748b);
		}
		.tender-card-info {
			--tender-card-color: var(--tender-blue);
		}
		.tender-card-success {
			--tender-card-color: var(--tender-green);
		}
		.tender-card-warning {
			--tender-card-color: var(--tender-orange);
		}
		.tender-card-danger {
			--tender-card-color: var(--tender-red);
		}
		.tender-health-value {
			display: block;
			margin-top: 7px;
			font-size: 21px;
			line-height: 1.15;
			font-weight: 750;
			color: var(--tender-card-color, var(--tender-ink));
			overflow-wrap: anywhere;
		}
		.tender-health-detail {
			display: block;
			margin-top: 4px;
			font-size: 11px;
			line-height: 1.35;
			color: var(--tender-muted);
			overflow-wrap: anywhere;
		}
		.tender-next-actions {
			min-width: 0;
			padding: 12px 14px;
			background: var(--tender-soft);
		}
		.tender-actions-title {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			margin-bottom: 8px;
			color: var(--tender-ink);
		}
		.tender-actions-list {
			display: flex;
			flex-direction: column;
			gap: 7px;
		}
		.tender-action-item {
			display: grid;
			grid-template-columns: 24px minmax(0, 1fr) auto;
			gap: 9px;
			align-items: center;
			width: 100%;
			min-height: 54px;
			padding: 8px 10px;
			border: 1px solid transparent;
			border-radius: 6px;
			background: var(--tender-surface);
			color: var(--tender-ink);
			text-align: start;
			cursor: pointer;
			transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
		}
		.tender-action-item:hover,
		.tender-action-item:focus {
			border-color: var(--tender-card-color, var(--tender-blue));
			box-shadow: 0 0 0 2px rgba(37, 99, 235, .08);
			outline: none;
		}
		.tender-action-icon {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 24px;
			height: 24px;
			border-radius: 6px;
			background: var(--tender-health-bg, var(--tender-soft));
			color: var(--tender-card-color, var(--tender-blue));
			flex: none;
		}
		.tender-action-main {
			min-width: 0;
		}
		.tender-action-title {
			display: block;
			font-size: 12px;
			line-height: 1.3;
			font-weight: 700;
			overflow-wrap: anywhere;
		}
		.tender-action-detail {
			display: block;
			margin-top: 2px;
			font-size: 11px;
			line-height: 1.35;
			color: var(--tender-muted);
			overflow-wrap: anywhere;
		}
		.tender-action-rank {
			font-size: 10px;
			line-height: 1.2;
			font-weight: 800;
			text-transform: uppercase;
			letter-spacing: 0;
			color: var(--tender-card-color, var(--tender-muted));
			white-space: nowrap;
		}
		.tender-action-danger {
			--tender-card-color: var(--tender-red);
			--tender-health-bg: var(--red-50, #fff5f5);
		}
		.tender-action-warning {
			--tender-card-color: var(--tender-orange);
			--tender-health-bg: var(--orange-50, #fff7ed);
		}
		.tender-action-info {
			--tender-card-color: var(--tender-blue);
			--tender-health-bg: var(--blue-50, #eff6ff);
		}
		.tender-action-success {
			--tender-card-color: var(--tender-green);
			--tender-health-bg: var(--green-50, #ecfdf5);
		}
		.tender-ai-review-note {
			display: flex;
			gap: 8px;
			padding: 9px 16px;
			border-top: 1px solid var(--tender-border);
			color: var(--tender-muted);
			font-size: 11px;
			line-height: 1.4;
		}
		.tender-ai-review-note .tender-action-icon {
			width: 22px;
			height: 22px;
		}
		${tender_presentation_css()}
		.tender-workspace-form .section-head {
			font-weight: 700;
			color: var(--tender-ink);
		}
		.tender-workspace-form .form-section {
			padding-block: 12px;
		}
		.tender-workspace-form .form-tabs-list {
			gap: 4px;
			padding: 6px 8px 0;
			border-bottom: 1px solid var(--tender-border);
			background: var(--tender-soft);
			border-radius: 8px 8px 0 0;
			overflow-x: auto;
		}
		.tender-workspace-form .form-tabs-list .nav-link {
			border: 1px solid transparent;
			border-radius: 6px 6px 0 0;
			color: var(--tender-muted);
			font-weight: 650;
			padding: 8px 12px;
			white-space: nowrap;
		}
		.tender-workspace-form .form-tabs-list .nav-link.active {
			background: var(--tender-surface);
			border-color: var(--tender-border);
			border-bottom-color: var(--tender-surface);
			color: var(--tender-blue);
			box-shadow: inset 0 2px 0 var(--tender-blue);
		}
		.tender-workspace-form .frappe-control[data-fieldname="status"] .control-value,
		.tender-workspace-form .frappe-control[data-fieldname="status"] .like-disabled-input,
		.tender-workspace-form .frappe-control[data-fieldname="status"] select {
			font-weight: 700;
			color: var(--blue-700, #1d4ed8);
			background: var(--blue-50, #eff6ff);
			border-color: var(--blue-200, #bfdbfe);
			border-radius: 6px;
		}
		.tender-workspace-page .page-actions .btn {
			border-radius: 6px;
			font-weight: 650;
		}
		.tender-workspace-page .page-actions .btn.btn-primary,
		.tender-workspace-page .page-actions .btn-primary {
			box-shadow: 0 4px 12px rgba(37, 99, 235, .18);
		}
		.tender-workspace-page .page-actions .dropdown-menu {
			border-radius: 8px;
			border-color: var(--border-color, #dfe3e8);
			box-shadow: 0 14px 32px rgba(15, 23, 42, .12);
		}
		.tender-workspace-page .page-actions .dropdown-item {
			padding: 8px 12px;
		}
		.tender-workspace-form .frappe-control[data-fieldname="uploaded_documents"] .grid,
		.tender-workspace-form .frappe-control[data-fieldname="ai_summary"] .grid,
		.tender-workspace-form .frappe-control[data-fieldname="boq_items"] .grid {
			border: 1px solid var(--tender-border);
			border-radius: 8px;
			background: var(--tender-surface);
			box-shadow: 0 8px 20px rgba(15, 23, 42, .05);
			overflow: hidden;
		}
		.tender-workspace-form .frappe-control[data-fieldname="uploaded_documents"] .grid-heading-row,
		.tender-workspace-form .frappe-control[data-fieldname="ai_summary"] .grid-heading-row,
		.tender-workspace-form .frappe-control[data-fieldname="boq_items"] .grid-heading-row {
			background: var(--tender-soft);
			border-bottom: 1px solid var(--tender-border);
			font-weight: 700;
			color: var(--tender-ink);
		}
		.tender-workspace-form .frappe-control[data-fieldname="uploaded_documents"] .grid-row,
		.tender-workspace-form .frappe-control[data-fieldname="ai_summary"] .grid-row,
		.tender-workspace-form .frappe-control[data-fieldname="boq_items"] .grid-row {
			transition: background-color .15s ease, border-color .15s ease;
			border-inline-start: 4px solid transparent;
		}
		.tender-workspace-form .frappe-control[data-fieldname="uploaded_documents"] .grid-row:hover,
		.tender-workspace-form .frappe-control[data-fieldname="ai_summary"] .grid-row:hover,
		.tender-workspace-form .frappe-control[data-fieldname="boq_items"] .grid-row:hover {
			background: var(--fg-hover-color, var(--tender-soft));
		}
		.tender-workspace-form .frappe-control[data-fieldname="uploaded_documents"] .grid-static-col,
		.tender-workspace-form .frappe-control[data-fieldname="ai_summary"] .grid-static-col,
		.tender-workspace-form .frappe-control[data-fieldname="boq_items"] .grid-static-col {
			min-height: 40px;
			align-items: center;
		}
		.tender-workspace-form .frappe-control[data-fieldname="ai_summary"] [data-fieldname="extracted_text"] .static-area,
		.tender-workspace-form .frappe-control[data-fieldname="boq_items"] [data-fieldname="description"] .static-area,
		.tender-workspace-form .frappe-control[data-fieldname="boq_items"] [data-fieldname="description_en"] .static-area,
		.tender-workspace-form .frappe-control[data-fieldname="boq_items"] [data-fieldname="specification"] .static-area {
			white-space: normal;
			overflow: visible;
			text-overflow: clip;
			line-height: 1.45;
		}
		.tender-workspace-form .grid-row.tender-row-danger {
			background: var(--red-50, #fff5f5) !important;
			border-inline-start-color: var(--tender-red);
		}
		.tender-workspace-form .grid-row.tender-row-missing,
		.tender-workspace-form .grid-row.tender-row-unpriced,
		.tender-workspace-form .grid-row.tender-row-ocr {
			background: var(--orange-50, #fff7ed) !important;
			border-inline-start-color: var(--tender-orange);
		}
		.tender-workspace-form .grid-row.tender-row-failed {
			background: var(--red-50, #fff5f5) !important;
			border-inline-start-color: var(--tender-red);
		}
		.tender-workspace-form .grid-row.tender-row-processing {
			background: var(--blue-50, #eff6ff) !important;
			border-inline-start-color: var(--tender-blue);
		}
		.tender-workspace-form .grid-row.tender-row-processed,
		.tender-workspace-form .grid-row.tender-row-confirmed {
			border-inline-start-color: var(--tender-green);
		}
		.tender-workspace-form .grid-row.tender-row-heading {
			background: var(--gray-50, #f9fafb) !important;
			font-weight: 700;
		}
		.tender-workspace-form .grid-row.tender-row-unpriced [data-fieldname="unit_price"],
		.tender-workspace-form .grid-row.tender-row-unpriced [data-fieldname="total"] {
			color: var(--orange-700, #c2410c);
			font-weight: 700;
		}
		${plaintext_selectors} {
			unicode-bidi: plaintext !important;
			text-align: start !important;
			line-height: 1.45;
		}
		@media (max-width: 768px) {
			.tender-health-header,
			.tender-health-body {
				grid-template-columns: 1fr;
			}
			.tender-health-status {
				align-items: flex-start;
				min-width: 0;
			}
			.tender-preview-trigger {
				width: auto;
			}
			.tender-health-metrics {
				grid-template-columns: repeat(2, minmax(0, 1fr));
				border-inline-end: 0;
			}
			.tender-health-metric:nth-child(3n) {
				border-inline-end: 1px solid var(--tender-border);
			}
			.tender-health-metric:nth-child(2n) {
				border-inline-end: 0;
			}
			.tender-health-metric:nth-last-child(-n + 3) {
				border-bottom: 1px solid var(--tender-border);
			}
			.tender-health-metric:nth-last-child(-n + 2) {
				border-bottom: 0;
			}
			.tender-next-actions {
				border-top: 1px solid var(--tender-border);
			}
			.tender-workspace-form .frappe-control[data-fieldname="uploaded_documents"] .grid,
			.tender-workspace-form .frappe-control[data-fieldname="ai_summary"] .grid,
			.tender-workspace-form .frappe-control[data-fieldname="boq_items"] .grid {
				overflow-x: auto;
			}
		}
		@media (max-width: 480px) {
			.tender-health-metrics {
				grid-template-columns: 1fr;
			}
			.tender-health-metric,
			.tender-health-metric:nth-child(2n),
			.tender-health-metric:nth-child(3n),
			.tender-health-metric:nth-last-child(-n + 2),
			.tender-health-metric:nth-last-child(-n + 3) {
				border-inline-end: 0;
				border-bottom: 1px solid var(--tender-border);
			}
			.tender-health-metric:last-child {
				border-bottom: 0;
			}
			.tender-health-header {
				padding: 12px;
			}
			.tender-health-value {
				font-size: 19px;
			}
			.tender-action-item {
				grid-template-columns: 24px minmax(0, 1fr);
			}
			.tender-action-rank {
				display: none;
			}
		}`;
	document.head.appendChild(style);
}

frappe.ui.form.on("Tender Workspace", {
	refresh(frm) {
		setup_tender_workspace_visuals(frm);

		// A compact at-a-glance summary works even for a brand-new record.
		render_tender_dashboard(frm);
		highlight_document_rows(frm);
		highlight_summary_rows(frm);
		highlight_boq_rows(frm);

		// Actions require a saved record.
		if (frm.is_new()) return;

		calculate_all_boq_totals(frm, true);

		const API = "ai_power_tender_management.api.tender_workspace";

		// Listen for background OCR/AI pipeline progress (bind once per form).
		if (!frm._tender_progress_bound) {
			frm._tender_progress_bound = true;
			frappe.realtime.on("tender_analyze_progress", (data) => {
				if (!data || data.name !== frm.doc.name) return;
				update_background_job(frm, data);
				frappe.show_alert({
					message: `${data.message || __("Processing…")} (${data.progress || 0}%)`,
					indicator: data.progress >= 100 ? "green" : "blue",
				});
				// Reload once the job is done, but keep the panel visible afterwards.
				if (data.reload) frm.reload_doc();
			});
		}

		// Restore the panel after a page reload — realtime events are not replayed.
		load_background_jobs(frm);

			const indicator_for_status = (status) => {
				if (status === "Processing") return "blue";
				return ["OCR Required", "AI Not Configured", "AI Failed", "No Items Found", "Failed", "Partial"].includes(status)
					? "orange"
					: "green";
			};

			const show_result_message = (m) => {
				if (!m.message) return;
				if (m.error_log) {
					frappe.msgprint({
						title: __("Tender Process Issue"),
						indicator: indicator_for_status(m.status),
						message: `
							<div>${frappe.utils.escape_html(m.message)}</div>
							<div style="margin-top:8px;">
								<a href="/app/error-log/${encodeURIComponent(m.error_log)}"
									target="_blank" rel="noopener">${__("View Error Log")}</a>
							</div>`,
					});
					return;
				}
				frappe.show_alert({ message: m.message, indicator: indicator_for_status(m.status) });
			};

		// Run a whitelisted API method, then reload the form to show the result.
		//
		// Methods that hand the work to a background job answer immediately with
		// `background: true`. For those the UI must NOT freeze — progress is shown
		// in the Background Processes panel instead, and the form reloads itself
		// when the job publishes its final event.
		const run = (method, freeze_message) => {
			frappe.call({
				method: `${API}.${method}`,
				args: { tender_workspace_name: frm.doc.name },
				freeze: true,
				freeze_message: freeze_message || __("Processing…"),
					callback: (r) => {
						const m = r.message || {};
						show_result_message(m);
					// Exports return a downloadable file — open it in a new tab.
					if (m.file_url) {
						window.open(m.file_url, "_blank");
					}
					if (m.background) {
						load_background_jobs(frm);
						return;
					}
					frm.reload_doc();
				},
			});
		};

		const proposal_sections = [
			{ label: __("Generate Scope Understanding"), section: "Scope Understanding" },
			{ label: __("Generate Methodology"), section: "Methodology" },
			{ label: __("Generate Implementation Plan"), section: "Implementation Plan" },
			{ label: __("Generate Project Timeline"), section: "Project Timeline" },
			{ label: __("Generate Equipment List"), section: "Equipment List" },
			{ label: __("Generate Organization Chart"), section: "Organization Chart" },
			{ label: __("Generate QA/QC Plan"), section: "QA/QC Plan" },
			{ label: __("Generate HSE Plan"), section: "HSE Plan" },
			{ label: __("Generate Compliance Matrix"), section: "Compliance Matrix" },
			{ label: __("Generate Risk Summary"), section: "Risk Summary" },
		];

		const run_section = (section) => {
			frappe.call({
				method: `${API}.generate_proposal_section`,
				args: {
					tender_workspace_name: frm.doc.name,
					section_type: section,
				},
				freeze: true,
				freeze_message: __("Queuing {0}…", [section]),
					callback: (r) => {
						const m = r.message || {};
						show_result_message(m);
					if (m.background) {
						load_background_jobs(frm);
						return;
					}
					frm.reload_doc();
				},
			});
		};

		// --- AI / processing actions ---
		frm.add_custom_button(
			__("Preview Presentation"),
			() => show_tender_presentation_preview(frm)
		);
		frm.add_custom_button(
			__("Preview Presentation"),
			() => show_tender_presentation_preview(frm),
			__("Tender Actions")
		);
		frm.add_custom_button(
			__("Extract Tender Info"),
			() => run("extract_tender_info", __("Extracting tender info…")),
			__("Tender Actions")
		);
		frm.add_custom_button(
			__("Analyze Tender Document"),
			() => run("analyze_tender_document", __("Analyzing document…")),
			__("Tender Actions")
		);
		frm.add_custom_button(
			__("Extract BOQ"),
			() => run("extract_boq", __("Extracting BOQ…")),
			__("Tender Actions")
		);
		frm.add_custom_button(
			__("Generate Proposal Sections"),
			() => run("generate_proposal_sections", __("Generating proposal sections…")),
			__("Tender Actions")
		);
		// frm.add_custom_button(
		// 	__("Generate Schedule"),
		// 	() => run("generate_schedule", __("Generating baseline schedule…")),
		// 	__("Tender Actions")
		// );
		if ((frm.doc.schedule_activities || []).length) {
			// Dates and float are derived from the network, so a hand-edited
			// duration or link needs a recalculation rather than a re-edit.
			// frm.add_custom_button(
			// 	__("Recalculate Schedule"),
			// 	() => run("recalculate_schedule", __("Recalculating dates and critical path…")),
			// 	__("Tender Actions")
			// );
			frm.add_custom_button(
				__("Check Schedule"),
				() => show_schedule_check(frm, API),
				__("Tender Actions")
			);
		}
		// The structure reuses the schedule's resources and phases, so it is
		// offered once there is a schedule to build it from.
		frm.add_custom_button(
			__("Generate Organization Structure"),
			() => run("generate_org_structure", __("Designing the organization structure…")),
			__("Tender Actions")
		);
		proposal_sections.forEach((item) => {
			frm.add_custom_button(
				item.label,
				() => run_section(item.section),
				__("Generate Section")
			);
		});

		// --- Manual status transitions (Status field is read-only) ---
		const set_status = (status) => {
			frm.set_value("status", status);
			frm.save().then(() => {
				frappe.show_alert({ message: __("Status set to {0}", [__(status)]), indicator: "green" });
			});
		};
		if (frm.doc.status !== "Reviewed" && frm.doc.status !== "Submitted") {
			frm.add_custom_button(__("Mark as Reviewed"), () => set_status("Reviewed"), __("Status"));
		}
		if (frm.doc.status !== "Submitted") {
			frm.add_custom_button(__("Mark as Submitted"), () => set_status("Submitted"), __("Status"));
		}

		// Surface the actions group prominently on the toolbar.
		frm.page.set_inner_btn_group_as_primary(__("Tender Actions"));
	},

	validate(frm) {
		calculate_all_boq_totals(frm);
	},

	tender_name(frm) {
		render_tender_dashboard(frm);
	},

	tender_name_ar(frm) {
		render_tender_dashboard(frm);
	},

	tender_number(frm) {
		render_tender_dashboard(frm);
	},

	client_name(frm) {
		render_tender_dashboard(frm);
	},

	closing_date(frm) {
		render_tender_dashboard(frm);
	},

	status(frm) {
		render_tender_dashboard(frm);
	},

	vat_rate(frm) {
		calculate_all_boq_totals(frm);
	},
});

// The AI supplies the schedule's dates, float and critical flags, so the numbers
// can disagree with each other. This surfaces those contradictions for the
// planning engineer to fix before the proposal goes out.
function show_schedule_check(frm, API) {
	frappe.call({
		method: `${API}.check_schedule`,
		args: { tender_workspace_name: frm.doc.name },
		freeze: true,
		freeze_message: __("Checking schedule…"),
		callback: (r) => {
			const m = r.message || {};
			const warnings = m.warnings || [];
			const body = warnings.length
				? `<ol style="padding-inline-start:18px;margin:0;">${warnings
						.map((w) => `<li style="margin:3px 0;">${frappe.utils.escape_html(w)}</li>`)
						.join("")}</ol>`
				: `<p style="color:var(--green-600,#059669);margin:0;">${__(
						"No inconsistencies found."
					)}</p>`;
			frappe.msgprint({
				title: __("Schedule Check — {0} activities", [m.activities_count || 0]),
				indicator: warnings.length ? "orange" : "green",
				message: body,
			});
		},
	});
}

frappe.ui.form.on("Tender AI Summary", {
	confirmed(frm) {
		render_tender_dashboard(frm);
		highlight_summary_rows(frm);
	},
	summary_type(frm) {
		render_tender_dashboard(frm);
		highlight_summary_rows(frm);
	},
	ai_summary_add(frm) {
		render_tender_dashboard(frm);
		highlight_summary_rows(frm);
	},
	ai_summary_remove(frm) {
		render_tender_dashboard(frm);
		highlight_summary_rows(frm);
	},
});

frappe.ui.form.on("Tender Document Item", {
	file(frm) {
		render_tender_dashboard(frm);
		highlight_document_rows(frm);
	},
	file_name(frm) {
		render_tender_dashboard(frm);
		highlight_document_rows(frm);
	},
	ai_status(frm) {
		render_tender_dashboard(frm);
		highlight_document_rows(frm);
	},
	readable_status(frm) {
		render_tender_dashboard(frm);
		highlight_document_rows(frm);
	},
	uploaded_documents_add(frm) {
		render_tender_dashboard(frm);
		highlight_document_rows(frm);
	},
	uploaded_documents_remove(frm) {
		render_tender_dashboard(frm);
		highlight_document_rows(frm);
	},
});

// ---------------------------------------------------------------------------
// Background Processes panel
//   Long AI/OCR steps (document analysis, BOQ extraction, proposal generation)
//   run in a background job. This panel is the user-visible half of that: it
//   lists every job the server knows about for this tender with a live progress
//   bar, updated over realtime and restored from the server after a reload.
// ---------------------------------------------------------------------------
// A running job is green and pulsing: the tender takes minutes of AI work, and
// the point of the panel is to reassure the user it is alive, not to warn them.
const JOB_STATE_STYLE = {
	queued: { color: "var(--gray-500, #718096)", dot: "static", label: "Queued" },
	running: { color: "var(--green-600, #059669)", dot: "pulse", label: "Running" },
	done: { color: "var(--green-600, #059669)", dot: "static", label: "Completed" },
	warning: { color: "var(--orange-500, #f97316)", dot: "static", label: "Needs Attention" },
	failed: { color: "var(--red-500, #e53e3e)", dot: "static", label: "Failed" },
};

// Keyframes for the running dot — injected once, alongside the RTL styles.
function inject_tender_job_styles() {
	if (document.getElementById("tender-job-style")) return;
	const style = document.createElement("style");
	style.id = "tender-job-style";
	style.textContent = `
		@keyframes tender-job-pulse {
			0%, 100% { opacity: 1; transform: scale(1); }
			50% { opacity: .35; transform: scale(.75); }
		}
		.tender-job-dot { width:10px;height:10px;border-radius:50%;display:inline-block;flex:none; }
		.tender-job-dot.pulse { animation: tender-job-pulse 1.2s ease-in-out infinite; }`;
	document.head.appendChild(style);
}

// Fetch the authoritative job list from the server and (re)draw the panel.
function load_background_jobs(frm) {
	frappe.call({
		method: "ai_power_tender_management.api.tender_workspace.get_background_jobs",
		args: { tender_workspace_name: frm.doc.name },
		callback: (r) => {
			frm._tender_jobs = {};
			((r.message || {}).jobs || []).forEach((job) => {
				frm._tender_jobs[job.key] = job;
			});
			render_background_panel(frm);
		},
	});
}

// Merge one realtime progress event into the panel without a server round-trip.
function update_background_job(frm, data) {
	frm._tender_jobs = frm._tender_jobs || {};
	const key = data.job_key || "analyze";
	frm._tender_jobs[key] = {
		key,
		label: data.label || key,
		state: data.state || (data.progress >= 100 ? "done" : "running"),
			message: data.message || "",
			progress: data.progress || 0,
			updated: data.updated || frappe.datetime.now_datetime(),
			error_log: data.error_log || null,
		};
		render_background_panel(frm);
	}

function render_background_panel(frm) {
	inject_tender_job_styles();

	// `frm.dashboard.reset()` drops custom sections on every form refresh, so the
	// cached node may be detached — recreate it in that case.
	if (frm._tender_jobs_section && !frm._tender_jobs_section.closest("body").length) {
		frm._tender_jobs_section = null;
	}

	const jobs = Object.values(frm._tender_jobs || {});
	// Nothing has ever run for this tender — don't take up space.
	if (!jobs.length) {
		if (frm._tender_jobs_section) frm._tender_jobs_section.closest(".form-dashboard-section").hide();
		return;
	}

	// Running jobs first, then the most recently finished ones.
	const weight = (job) => (["queued", "running"].includes(job.state) ? 0 : 1);
	jobs.sort((a, b) => weight(a) - weight(b) || (b.updated || "").localeCompare(a.updated || ""));

	const rows = jobs
		.map((job) => {
			const style = JOB_STATE_STYLE[job.state] || JOB_STATE_STYLE.running;
			const pct = Math.max(0, Math.min(100, cint(job.progress)));
			const active = ["queued", "running"].includes(job.state);
			return `
			<div style="padding:10px 0;border-bottom:1px solid var(--border-color);">
				<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
					<span class="tender-job-dot ${style.dot}" style="background:${style.color};"></span>
					<span style="font-weight:600;">${frappe.utils.escape_html(__(job.label))}</span>
					<span style="font-size:11px;padding:1px 8px;border-radius:10px;color:${style.color};
						border:1px solid ${style.color};text-transform:uppercase;letter-spacing:.04em;">
						${__(style.label)}
					</span>
					<span style="margin-inline-start:auto;font-size:12px;color:var(--text-muted);">${pct}%</span>
				</div>
				<div style="margin-top:6px;height:6px;border-radius:4px;background:var(--control-bg);overflow:hidden;">
					<div style="height:100%;width:${pct}%;background:${style.color};transition:width .3s ease;"></div>
				</div>
				<div style="margin-top:6px;font-size:12px;color:var(--text-muted);unicode-bidi:plaintext;">
					${frappe.utils.escape_html(job.message || "")}
				</div>
				${
					active
						? `<div style="margin-top:4px;font-size:11px;color:var(--text-muted);">
						${__("You can keep working — we will let you know here once it is completed.")}
					</div>`
						: `<div style="margin-top:4px;font-size:11px;display:flex;gap:12px;">
						${
							job.error_log
								? `<a href="/app/error-log/${encodeURIComponent(job.error_log)}"
									target="_blank" rel="noopener">${__("View Error Log")}</a>`
								: ""
						}
						<a href="#" data-tender-dismiss="${frappe.utils.escape_html(job.key)}"
							style="color:var(--text-muted);">${__("Dismiss")}</a>
					</div>`
				}
			</div>`;
		})
		.join("");

	const html = `<div style="padding:0 4px;">${rows}</div>`;

	if (!frm._tender_jobs_section) {
		frm._tender_jobs_section = frm.dashboard.add_section(html, __("Background Processes"));
	} else {
		frm._tender_jobs_section.html(html);
	}
	frm._tender_jobs_section.closest(".form-dashboard-section").show();

	// Finished entries linger for a day so they survive a reload, which lets a
	// stale failure sit here contradicting the tender's current state.
	frm._tender_jobs_section.find("[data-tender-dismiss]").on("click", (e) => {
		e.preventDefault();
		const key = $(e.currentTarget).attr("data-tender-dismiss");
		frappe.call({
			method: "ai_power_tender_management.api.tender_workspace.dismiss_background_job",
			args: { tender_workspace_name: frm.doc.name, job_key: key },
			callback: (r) => {
				const m = r.message || {};
				if (m.status === "Dismissed") {
					delete (frm._tender_jobs || {})[key];
					render_background_panel(frm);
				} else if (m.message) {
					frappe.show_alert({ message: m.message, indicator: "orange" });
				}
			},
		});
	});

	// Safety net: realtime is the primary channel, but poll while something is
	// still running so the panel can never get stuck on a stale "Running".
	clearTimeout(frm._tender_jobs_timer);
	if (jobs.some((job) => ["queued", "running"].includes(job.state))) {
		frm._tender_jobs_timer = setTimeout(() => {
			if (cur_frm === frm && frm.doc && !frm.is_new()) load_background_jobs(frm);
		}, 15000);
	}
}

// Summary types that represent risk items worth flagging visually.
const DANGER_TYPES = ["Dangerous Clause", "Penalty Clause"];

function tender_escape(value) {
	return frappe.utils.escape_html(value == null || value === "" ? "" : String(value));
}

function tender_css_class(value) {
	return String(value || "draft")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function tender_icon(name, size = "sm") {
	return frappe.utils && frappe.utils.icon ? frappe.utils.icon(name, size) : "";
}

function tender_health_metric(label, value, detail, tone) {
	return `
		<div class="tender-health-metric tender-card-${tone || "neutral"}">
			<span class="tender-health-label">${tender_escape(label)}</span>
			<span class="tender-health-value">${tender_escape(value)}</span>
			<span class="tender-health-detail">${tender_escape(detail)}</span>
		</div>`;
}

function tender_action_item(action) {
	return `
		<button type="button"
			class="tender-action-item tender-action-${tender_css_class(action.tone || "info")}"
			data-tender-target="${tender_escape(action.target || "")}"
			aria-label="${tender_escape(action.title)}">
			<span class="tender-action-icon">${tender_icon(action.icon || "right", "sm")}</span>
			<span class="tender-action-main">
				<span class="tender-action-title">${tender_escape(action.title)}</span>
				<span class="tender-action-detail">${tender_escape(action.detail)}</span>
			</span>
			<span class="tender-action-rank">${tender_escape(action.rank)}</span>
		</button>`;
}

function mark_grid_row(gr, classes) {
	if (!gr.row) return;
	gr.row.removeClass(TENDER_ROW_STATE_CLASSES);
	if (classes.length) gr.row.addClass(classes.join(" "));
}

function tender_days_until(date_value) {
	if (!date_value) return null;
	if (frappe.datetime && frappe.datetime.get_diff && frappe.datetime.get_today) {
		return cint(frappe.datetime.get_diff(date_value, frappe.datetime.get_today()));
	}

	const parts = String(date_value).split("-");
	if (parts.length < 3) return null;
	const closing = new Date(cint(parts[0]), cint(parts[1]) - 1, cint(parts[2]));
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	closing.setHours(0, 0, 0, 0);
	return Math.round((closing.getTime() - today.getTime()) / 86400000);
}

function tender_deadline_state(date_value) {
	if (!date_value) {
		return {
			label: __("No deadline"),
			detail: __("Closing date is not set"),
			tone: "warning",
			days_left: null,
		};
	}

	const days_left = tender_days_until(date_value);
	const date_label = frappe.datetime.str_to_user(date_value);
	if (days_left == null) {
		return {
			label: date_label,
			detail: __("Closing date"),
			tone: "neutral",
			days_left,
		};
	}
	if (days_left < 0) {
		return {
			label: __("{0} days overdue", [Math.abs(days_left)]),
			detail: __("Closed {0}", [date_label]),
			tone: "danger",
			days_left,
		};
	}
	if (days_left === 0) {
		return {
			label: __("Due today"),
			detail: __("Closes {0}", [date_label]),
			tone: "danger",
			days_left,
		};
	}
	if (days_left === 1) {
		return {
			label: __("Due tomorrow"),
			detail: __("Closes {0}", [date_label]),
			tone: "warning",
			days_left,
		};
	}
	if (days_left <= 7) {
		return {
			label: __("{0} days left", [days_left]),
			detail: __("Closes {0}", [date_label]),
			tone: "warning",
			days_left,
		};
	}
	return {
		label: __("{0} days left", [days_left]),
		detail: __("Closes {0}", [date_label]),
		tone: "success",
		days_left,
	};
}

function tender_is_generated_proposal(row) {
	return Boolean(row.content) || ["Generated", "Reviewed", "Approved"].includes(row.status);
}

function tender_is_reviewed_proposal(row) {
	return Boolean(row.confirmed) || ["Reviewed", "Approved"].includes(row.status);
}

function tender_rank_label(priority) {
	if (priority <= 0) return __("High");
	if (priority === 1) return __("Next");
	return __("Later");
}

function build_tender_actions(state) {
	const actions = [];
	const add = (priority, tone, icon, title, detail, target) => {
		actions.push({
			priority,
			tone,
			icon,
			title,
			detail,
			target,
			rank: tender_rank_label(priority),
			order: actions.length,
		});
	};

	if (!state.closing_date) {
		add(2, "warning", "edit", __("Set tender deadline"), __("Closing date is missing"), "closing_date");
	} else if (state.deadline.days_left != null && state.deadline.days_left < 0) {
		add(0, "danger", "solid-warning", __("Resolve overdue deadline"), state.deadline.detail, "closing_date");
	} else if (state.deadline.days_left != null && state.deadline.days_left <= 2) {
		add(0, "danger", "solid-warning", __("Prioritize submission deadline"), state.deadline.detail, "closing_date");
	} else if (state.deadline.days_left != null && state.deadline.days_left <= 7) {
		add(1, "warning", "solid-warning", __("Watch tender deadline"), state.deadline.detail, "closing_date");
	}

	if (!state.uploaded_documents) {
		add(0, "warning", "upload", __("Upload tender documents"), __("Add source files before AI analysis"), "uploaded_documents");
	} else {
		if (state.failed_documents || state.ocr_documents) {
			add(
				0,
				"danger",
				"solid-warning",
				__("Fix document readiness"),
				__("{0} failed, {1} need OCR", [state.failed_documents, state.ocr_documents]),
				"uploaded_documents"
			);
		}
		if (state.processing_documents) {
			add(
				2,
				"info",
				"search",
				__("Check document processing"),
				__("{0} document(s) still processing", [state.processing_documents]),
				"uploaded_documents"
			);
		}
		if (!state.has_analysis && !state.processing_documents && !state.failed_documents && !state.ocr_documents) {
			add(1, "info", "search", __("Run AI extraction"), __("No summary or knowledge cache is ready"), "ai_summary");
		}
	}

	if (state.unresolved_ai_flags) {
		add(
			0,
			state.dangerous_clauses ? "danger" : "warning",
			"solid-warning",
			__("Review AI risks and missing information"),
			__("{0} unresolved flag(s)", [state.unresolved_ai_flags]),
			"ai_summary"
		);
	}

	if (state.unpriced_boq_lines) {
		add(
			0,
			"warning",
			"sheet",
			__("Add rates to BOQ lines"),
			__("{0} line(s) still need rates", [state.unpriced_boq_lines]),
			"boq_items"
		);
	} else if (!state.boq_rows && state.uploaded_documents) {
		add(1, "info", "sheet", __("Extract or verify BOQ"), __("No BOQ lines are available yet"), "boq_items");
	}

	if (!state.proposal_sections) {
		add(1, "info", "edit", __("Generate proposal sections"), __("No proposal sections are available yet"), "proposal_sections");
	} else if (state.pending_proposal_sections) {
		add(
			1,
			"warning",
			"edit",
			__("Complete proposal sections"),
			__("{0} section(s) need content or generation", [state.pending_proposal_sections]),
			"proposal_sections"
		);
	}

	if (state.review_total && state.reviewed_items < state.review_total) {
		add(
			1,
			"warning",
			"tick",
			__("Confirm reviewed items"),
			__("{0} of {1} confirmed", [state.reviewed_items, state.review_total]),
			state.ai_rows ? "ai_summary" : "proposal_sections"
		);
	}

	if (!actions.length) {
		add(
			2,
			"success",
			"solid-success",
			__("Final submission review"),
			__("Readiness checks are clear"),
			"status"
		);
	}

	const targets = new Set();
	return actions
		.sort((a, b) => a.priority - b.priority || a.order - b.order)
		.filter((action) => {
			if (targets.has(action.target)) return false;
			targets.add(action.target);
			return true;
		})
		.slice(0, 5);
}

function build_tender_health_state(frm) {
	const rows = frm.doc.ai_summary || [];
	const risk_rows = rows.filter((r) => DANGER_TYPES.includes(r.summary_type) || r.summary_type === "Missing Information");
	const dangerous_clauses = rows.filter((r) => DANGER_TYPES.includes(r.summary_type)).length;
	const missing_information = rows.filter((r) => r.summary_type === "Missing Information").length;
	const confirmed_ai_rows = rows.filter((r) => r.confirmed).length;
	const unresolved_ai_flags = risk_rows.filter((r) => !r.confirmed).length;
	const boq_rows = frm.doc.boq_items || [];
	const priceable_boq_rows = boq_rows.filter((r) => is_priced_boq_item(r) && flt(r.quantity) > 0);
	const priced_boq_lines = priceable_boq_rows.filter((r) => flt(r.unit_price) > 0).length;
	const unpriced_boq_lines = Math.max(priceable_boq_rows.length - priced_boq_lines, 0);
	const proposal_rows = frm.doc.proposal_sections || [];
	const generated_proposals = proposal_rows.filter(tender_is_generated_proposal).length;
	const reviewed_proposals = proposal_rows.filter(tender_is_reviewed_proposal).length;
	const pending_proposal_sections = proposal_rows.filter((r) => !tender_is_generated_proposal(r)).length;
	const documents = frm.doc.uploaded_documents || [];
	const uploaded_documents = documents.filter((r) => r.file || r.file_name).length;
	const processing_documents = documents.filter((r) => r.ai_status === "Processing").length;
	const failed_documents = documents.filter((r) => r.ai_status === "Failed").length;
	const ocr_documents = documents.filter((r) => {
		return r.ai_status === "OCR Required" || r.readable_status === "OCR Required";
	}).length;
	const analyzed_documents = documents.filter((r) => ["Processed", "Extracted"].includes(r.ai_status)).length;
	const has_analysis = Boolean(
		rows.length ||
			frm.doc.knowledge_updated_on ||
			frm.doc.knowledge_chunks_json ||
			frm.doc.structured_analysis_json
	);
	const review_total = rows.length + proposal_rows.length;
	const reviewed_items = confirmed_ai_rows + reviewed_proposals;
	const deadline = tender_deadline_state(frm.doc.closing_date);

	return {
		ai_rows: rows.length,
		analyzed_documents,
		boq_rows: boq_rows.filter(is_priced_boq_item).length,
		closing_date: frm.doc.closing_date,
		confirmed_ai_rows,
		dangerous_clauses,
		deadline,
		documents: documents.length,
		failed_documents,
		generated_proposals,
		has_analysis,
		missing_information,
		ocr_documents,
		pending_proposal_sections,
		priceable_boq_lines: priceable_boq_rows.length,
		priced_boq_lines,
		processing_documents,
		proposal_sections: proposal_rows.length,
		review_total,
		reviewed_items,
		unpriced_boq_lines,
		unresolved_ai_flags,
		uploaded_documents,
	};
}

function tender_readiness_state(state) {
	if (!state.uploaded_documents) {
		return {
			label: __("Setup Needed"),
			detail: __("Upload tender documents to start the workflow"),
			tone: "warning",
		};
	}
	if (state.deadline.days_left != null && state.deadline.days_left < 0) {
		return {
			label: __("Blocked"),
			detail: __("Tender deadline has passed"),
			tone: "danger",
		};
	}
	if (state.failed_documents || state.ocr_documents) {
		return {
			label: __("Blocked"),
			detail: __("Documents need extraction attention"),
			tone: "danger",
		};
	}
	if (state.unpriced_boq_lines) {
		return {
			label: __("Needs Pricing"),
			detail: __("{0} BOQ line(s) need rates", [state.unpriced_boq_lines]),
			tone: "warning",
		};
	}
	if (!state.has_analysis || state.unresolved_ai_flags || !state.proposal_sections || state.pending_proposal_sections) {
		return {
			label: __("Needs Work"),
			detail: state.unresolved_ai_flags
				? __("AI risks or missing information need review")
				: __("Extraction or proposal content is incomplete"),
			tone: "warning",
		};
	}
	if (state.review_total && state.reviewed_items < state.review_total) {
		return {
			label: __("Ready for Review"),
			detail: __("{0} of {1} review items confirmed", [state.reviewed_items, state.review_total]),
			tone: "info",
		};
	}
	return {
		label: __("Ready to Submit"),
		detail: __("Core readiness checks are clear"),
		tone: "success",
	};
}

function bind_tender_dashboard_actions(frm) {
	const $dashboard = frm.dashboard && frm.dashboard.wrapper
		? $(frm.dashboard.wrapper).find(".tender-desk-dashboard").last()
		: $();
	if (!$dashboard.length) return;

	$dashboard.find("[data-tender-target]").on("click", (e) => {
		e.preventDefault();
		const target = $(e.currentTarget).attr("data-tender-target");
		if (!target) return;
		if (frm.scroll_to_field && frm.scroll_to_field(target)) return;
		frappe.show_alert({ message: __("Could not find field {0}", [target]), indicator: "orange" });
	});

	$dashboard.find("[data-tender-preview]").on("click", (e) => {
		e.preventDefault();
		show_tender_presentation_preview(frm);
	});
}

function tender_presentation_css() {
	return `
		.tender-presentation-dialog .modal-dialog {
			max-width: min(1180px, calc(100vw - 32px));
		}
		.tender-presentation-dialog .modal-body {
			background: #eef2f7;
			padding: 0;
		}
		.tender-presentation {
			--tp-ink: #172033;
			--tp-muted: #667085;
			--tp-soft: #f6f8fb;
			--tp-border: #dde3ec;
			--tp-blue: #2563eb;
			--tp-green: #059669;
			--tp-orange: #ea580c;
			--tp-red: #dc2626;
			max-width: 1080px;
			margin: 0 auto;
			background: #fff;
			color: var(--tp-ink);
			font-family: Inter, "Segoe UI", Arial, sans-serif;
			line-height: 1.5;
			box-shadow: 0 18px 48px rgba(15, 23, 42, .16);
		}
		.tender-presentation * {
			box-sizing: border-box;
		}
		.tp-cover {
			padding: 34px 38px 28px;
			color: #fff;
			background: linear-gradient(135deg, #172033 0%, #234b7b 58%, #0f766e 100%);
		}
		.tp-kicker {
			display: block;
			font-size: 11px;
			font-weight: 800;
			letter-spacing: .08em;
			text-transform: uppercase;
			opacity: .76;
		}
		.tp-title {
			margin: 7px 0 8px;
			font-size: 31px;
			line-height: 1.14;
			font-weight: 760;
			letter-spacing: 0;
			overflow-wrap: anywhere;
			unicode-bidi: plaintext;
		}
		.tp-subtitle {
			max-width: 780px;
			font-size: 13px;
			opacity: .86;
			unicode-bidi: plaintext;
		}
		.tp-cover-grid {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 10px;
			margin-top: 24px;
		}
		.tp-cover-fact {
			min-height: 74px;
			padding: 11px 12px;
			border: 1px solid rgba(255,255,255,.22);
			border-radius: 8px;
			background: rgba(255,255,255,.1);
		}
		.tp-label {
			display: block;
			font-size: 10px;
			line-height: 1.25;
			font-weight: 800;
			letter-spacing: .06em;
			text-transform: uppercase;
			color: inherit;
			opacity: .68;
		}
		.tp-value {
			display: block;
			margin-top: 5px;
			font-size: 14px;
			font-weight: 720;
			overflow-wrap: anywhere;
			unicode-bidi: plaintext;
		}
		.tp-body {
			padding: 26px 30px 34px;
		}
		.tp-metrics {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 12px;
			margin-bottom: 18px;
		}
		.tp-metric {
			position: relative;
			min-height: 94px;
			padding: 13px 14px;
			border: 1px solid var(--tp-border);
			border-radius: 8px;
			background: var(--tp-soft);
			overflow: hidden;
		}
		.tp-metric:before {
			content: "";
			position: absolute;
			inset-block: 0;
			inset-inline-start: 0;
			width: 4px;
			background: var(--tp-tone, var(--tp-blue));
		}
		.tp-tone-neutral { --tp-tone: #64748b; }
		.tp-tone-info { --tp-tone: var(--tp-blue); }
		.tp-tone-success { --tp-tone: var(--tp-green); }
		.tp-tone-warning { --tp-tone: var(--tp-orange); }
		.tp-tone-danger { --tp-tone: var(--tp-red); }
		.tp-metric-number {
			display: block;
			margin-top: 8px;
			font-size: 24px;
			line-height: 1.1;
			font-weight: 780;
			color: var(--tp-tone, var(--tp-blue));
			overflow-wrap: anywhere;
		}
		.tp-metric-detail {
			display: block;
			margin-top: 5px;
			font-size: 11px;
			color: var(--tp-muted);
			overflow-wrap: anywhere;
		}
		.tp-section {
			margin-top: 18px;
			padding: 18px;
			border: 1px solid var(--tp-border);
			border-radius: 8px;
			background: #fff;
			break-inside: avoid;
		}
		.tp-section-head {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 12px;
			margin-bottom: 12px;
		}
		.tp-section h2 {
			margin: 0;
			font-size: 18px;
			line-height: 1.25;
			font-weight: 760;
			color: var(--tp-ink);
		}
		.tp-section-note {
			font-size: 12px;
			color: var(--tp-muted);
		}
		.tp-card-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}
		.tp-risk-card,
		.tp-proposal-card,
		.tp-role-card {
			padding: 13px 14px;
			border: 1px solid var(--tp-border);
			border-radius: 8px;
			background: var(--tp-soft);
			break-inside: avoid;
		}
		.tp-risk-card {
			border-inline-start: 4px solid var(--tp-tone, var(--tp-blue));
		}
		.tp-card-title {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			margin-bottom: 7px;
			font-size: 13px;
			font-weight: 760;
			overflow-wrap: anywhere;
		}
		.tp-pill {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 3px 8px;
			border-radius: 999px;
			background: #fff;
			color: var(--tp-tone, var(--tp-muted));
			border: 1px solid currentColor;
			font-size: 10px;
			line-height: 1.2;
			font-weight: 800;
			white-space: nowrap;
		}
		.tp-card-body {
			font-size: 12px;
			color: var(--tp-ink);
			overflow-wrap: anywhere;
			unicode-bidi: plaintext;
		}
		.tp-muted {
			color: var(--tp-muted);
		}
		.tp-table-wrap {
			overflow-x: auto;
			border: 1px solid var(--tp-border);
			border-radius: 8px;
		}
		.tp-table {
			width: 100%;
			border-collapse: collapse;
			font-size: 12px;
			background: #fff;
		}
		.tp-table th {
			padding: 9px 10px;
			background: var(--tp-soft);
			border-bottom: 1px solid var(--tp-border);
			color: var(--tp-muted);
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: .04em;
			text-align: start;
			white-space: nowrap;
		}
		.tp-table td {
			padding: 9px 10px;
			border-bottom: 1px solid var(--tp-border);
			vertical-align: top;
			overflow-wrap: anywhere;
			unicode-bidi: plaintext;
		}
		.tp-table tr:last-child td {
			border-bottom: 0;
		}
		.tp-table .tp-number {
			text-align: end;
			white-space: nowrap;
			font-variant-numeric: tabular-nums;
		}
		.tp-total-strip {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 10px;
			margin-top: 12px;
		}
		.tp-total-box {
			padding: 11px 12px;
			border: 1px solid var(--tp-border);
			border-radius: 8px;
			background: var(--tp-soft);
		}
		.tp-total-box strong {
			display: block;
			margin-top: 4px;
			font-size: 15px;
			color: var(--tp-ink);
		}
		.tp-proposal-card {
			background: #fff;
		}
		.tp-proposal-content {
			margin-top: 8px;
			font-size: 12px;
			color: var(--tp-ink);
			overflow-wrap: anywhere;
			unicode-bidi: plaintext;
		}
		.tp-proposal-content * {
			unicode-bidi: plaintext;
			text-align: start;
		}
		.tp-proposal-content p {
			margin: 0 0 8px;
		}
		.tp-proposal-content ul,
		.tp-proposal-content ol {
			margin: 6px 0 8px 20px;
			padding: 0;
		}
		.tp-empty {
			padding: 14px;
			border: 1px dashed var(--tp-border);
			border-radius: 8px;
			background: var(--tp-soft);
			color: var(--tp-muted);
			font-size: 12px;
		}
		@media (max-width: 860px) {
			.tp-cover-grid,
			.tp-metrics {
				grid-template-columns: repeat(2, minmax(0, 1fr));
			}
			.tp-card-grid {
				grid-template-columns: 1fr;
			}
			.tp-body {
				padding: 18px;
			}
		}
		@media (max-width: 560px) {
			.tp-cover {
				padding: 24px 20px;
			}
			.tp-title {
				font-size: 24px;
			}
			.tp-cover-grid,
			.tp-metrics,
			.tp-total-strip {
				grid-template-columns: 1fr;
			}
		}
		@media print {
			body {
				background: #fff !important;
			}
			.tender-presentation {
				max-width: none;
				box-shadow: none;
			}
			.tp-section {
				break-inside: avoid;
			}
		}`;
}

function tender_format_date(value) {
	return value ? frappe.datetime.str_to_user(value) : __("Not set");
}

function tender_format_money(value, currency) {
	const amount = flt(value || 0);
	if (typeof format_currency === "function") {
		return format_currency(amount, currency || undefined);
	}
	return amount.toLocaleString();
}

function tender_boq_totals(frm) {
	const subtotal = (frm.doc.boq_items || []).reduce((sum, row) => {
		return sum + (is_priced_boq_item(row) ? flt(row.quantity) * flt(row.unit_price) : 0);
	}, 0);
	const vat_rate = flt(frm.doc.vat_rate || 0);
	const vat_amount = subtotal * vat_rate / 100;
	return {
		subtotal,
		vat_amount,
		grand_total: subtotal + vat_amount,
	};
}

function tender_decode_html_entities(value) {
	let text = String(value || "");
	if (!text || typeof document === "undefined" || !document.createElement) return text;

	for (let i = 0; i < 2; i++) {
		if (!/&(?:lt|gt|amp|quot|#39|nbsp);/i.test(text)) break;
		const textarea = document.createElement("textarea");
		textarea.innerHTML = text;
		const decoded = textarea.value;
		if (decoded === text) break;
		text = decoded;
	}
	return text;
}

function tender_sanitize_html_fragment(html) {
	if (typeof document === "undefined" || !document.createElement) {
		return tender_escape(html).replace(/\n/g, "<br>");
	}

	const allowed_tags = new Set([
		"a", "b", "blockquote", "br", "div", "em", "h1", "h2", "h3", "h4", "i", "li",
		"ol", "p", "span", "strong", "table", "tbody", "td", "th", "thead", "tr", "u", "ul",
	]);
	const blocked_tags = new Set(["script", "style", "iframe", "object", "embed", "link", "meta"]);
	const template = document.createElement("template");
	template.innerHTML = html;
	const is_safe_href = (href) => /^(https?:|mailto:|tel:|\/|#)/i.test(String(href || "").trim());

	const unwrap = (node) => {
		const parent = node.parentNode;
		if (!parent) return;
		while (node.firstChild) parent.insertBefore(node.firstChild, node);
		parent.removeChild(node);
	};

	const clean = (parent) => {
		Array.from(parent.childNodes || []).forEach((node) => {
			if (node.nodeType === 3) return;
			if (node.nodeType !== 1) {
				node.remove();
				return;
			}

			const tag = node.tagName.toLowerCase();
			if (blocked_tags.has(tag)) {
				node.remove();
				return;
			}
			if (!allowed_tags.has(tag)) {
				clean(node);
				unwrap(node);
				return;
			}

			Array.from(node.attributes || []).forEach((attr) => {
				const name = attr.name.toLowerCase();
				const value = attr.value;
				const safe_common = ["dir", "lang"].includes(name);
				const safe_table = ["td", "th"].includes(tag) && ["colspan", "rowspan"].includes(name);
				const safe_link = tag === "a" && name === "href" && is_safe_href(value);
				if (name.startsWith("on") || (!safe_common && !safe_table && !safe_link)) {
					node.removeAttribute(attr.name);
				}
			});
			if (tag === "a" && node.getAttribute("href")) {
				node.setAttribute("target", "_blank");
				node.setAttribute("rel", "noopener noreferrer");
			}
			clean(node);
		});
	};

	clean(template.content);
	return template.innerHTML;
}

function tender_safe_html(value) {
	const decoded = tender_decode_html_entities(value);
	if (!/<\/?[a-z][\s\S]*>/i.test(decoded)) {
		return tender_escape(decoded).replace(/\n/g, "<br>");
	}
	return tender_sanitize_html_fragment(decoded);
}

function tender_presentation_metric(label, value, detail, tone) {
	return `
		<div class="tp-metric tp-tone-${tender_css_class(tone || "neutral")}">
			<span class="tp-label">${tender_escape(label)}</span>
			<span class="tp-metric-number">${tender_escape(value)}</span>
			<span class="tp-metric-detail">${tender_escape(detail)}</span>
		</div>`;
}

function tender_empty_state(message) {
	return `<div class="tp-empty">${tender_escape(message)}</div>`;
}

function tender_summary_tone(row) {
	if (DANGER_TYPES.includes(row.summary_type)) return "danger";
	if (row.summary_type === "Missing Information") return "warning";
	if (row.confirmed) return "success";
	return "info";
}

function build_presentation_summary_cards(rows) {
	if (!rows.length) {
		return tender_empty_state(__("No AI summary rows yet. Run AI analysis to populate this section."));
	}

	return `
		<div class="tp-card-grid">
			${rows.map((row) => {
				const tone = tender_summary_tone(row);
				return `
					<div class="tp-risk-card tp-tone-${tone}">
						<div class="tp-card-title">
							<span>${tender_escape(row.summary_type || __("Summary"))}</span>
							<span class="tp-pill">${row.confirmed ? tender_escape(__("Confirmed")) : tender_escape(__("Review"))}</span>
						</div>
						<div class="tp-card-body">${tender_escape(row.extracted_text || row.ai_summary || __("No detail captured."))}</div>
						${row.source_document || row.page_number ? `
							<div class="tp-card-body tp-muted" style="margin-top:8px;">
								${tender_escape([row.source_document, row.page_number ? __("Page {0}", [row.page_number]) : null].filter(Boolean).join(" - "))}
							</div>` : ""}
					</div>`;
			}).join("")}
		</div>`;
}

function build_presentation_boq_section(frm) {
	const rows = (frm.doc.boq_items || []).filter(is_priced_boq_item);
	const currency = frm.doc.boq_currency || "";
	const totals = tender_boq_totals(frm);
	if (!rows.length) {
		return tender_empty_state(__("No BOQ rows yet. Extract BOQ or add pricing lines to populate this section."));
	}

	const table_rows = rows.slice(0, 14).map((row) => {
		const total = flt(row.total) || flt(row.quantity) * flt(row.unit_price);
		return `
			<tr>
				<td>${tender_escape(row.item_no || "")}</td>
				<td>${tender_escape(row.description || row.description_en || "")}</td>
				<td>${tender_escape(row.unit || "")}</td>
				<td class="tp-number">${tender_escape(flt(row.quantity || 0))}</td>
				<td class="tp-number">${tender_escape(tender_format_money(row.unit_price, currency))}</td>
				<td class="tp-number">${tender_escape(tender_format_money(total, currency))}</td>
			</tr>`;
	}).join("");
	const remaining = Math.max(rows.length - 14, 0);

	return `
		<div class="tp-table-wrap">
			<table class="tp-table">
				<thead>
					<tr>
						<th>${tender_escape(__("Item"))}</th>
						<th>${tender_escape(__("Description"))}</th>
						<th>${tender_escape(__("Unit"))}</th>
						<th class="tp-number">${tender_escape(__("Qty"))}</th>
						<th class="tp-number">${tender_escape(__("Rate"))}</th>
						<th class="tp-number">${tender_escape(__("Total"))}</th>
					</tr>
				</thead>
				<tbody>${table_rows}</tbody>
			</table>
		</div>
		${remaining ? `<div class="tp-section-note" style="margin-top:8px;">${tender_escape(__("+ {0} more BOQ line(s) in the child table", [remaining]))}</div>` : ""}
		<div class="tp-total-strip">
			<div class="tp-total-box">
				<span class="tp-label">${tender_escape(__("Subtotal"))}</span>
				<strong>${tender_escape(tender_format_money(totals.subtotal, currency))}</strong>
			</div>
			<div class="tp-total-box">
				<span class="tp-label">${tender_escape(__("VAT"))}</span>
				<strong>${tender_escape(tender_format_money(totals.vat_amount, currency))}</strong>
			</div>
			<div class="tp-total-box">
				<span class="tp-label">${tender_escape(__("Grand Total"))}</span>
				<strong>${tender_escape(tender_format_money(totals.grand_total, currency))}</strong>
			</div>
		</div>`;
}

function build_presentation_proposal_sections(frm) {
	const rows = frm.doc.proposal_sections || [];
	if (!rows.length) {
		return tender_empty_state(__("No proposal sections yet. Generate proposal sections to populate this presentation."));
	}

	return rows.map((row, index) => `
		<div class="tp-proposal-card">
			<div class="tp-card-title">
				<span>${index + 1}. ${tender_escape(row.title || row.section_type || __("Proposal Section"))}</span>
				<span class="tp-pill">${tender_escape(row.status || __("Draft"))}</span>
			</div>
			<div class="tp-proposal-content">
				${row.content ? tender_safe_html(row.content) : `<span class="tp-muted">${tender_escape(__("No content generated yet."))}</span>`}
			</div>
		</div>`).join("");
}

function build_presentation_schedule_section(frm) {
	const rows = frm.doc.schedule_activities || [];
	if (!rows.length) {
		return tender_empty_state(__("No schedule activities yet."));
	}

	const table_rows = rows.slice(0, 12).map((row) => `
		<tr>
			<td>${tender_escape(row.wbs || row.activity_id || "")}</td>
			<td>${tender_escape(row.activity_name || "")}</td>
			<td class="tp-number">${tender_escape(row.original_duration || 0)}</td>
			<td>${tender_escape(tender_format_date(row.planned_start))}</td>
			<td>${tender_escape(tender_format_date(row.planned_finish))}</td>
			<td>${row.is_critical ? tender_escape(__("Critical")) : tender_escape(row.status || "")}</td>
		</tr>`).join("");
	const remaining = Math.max(rows.length - 12, 0);

	return `
		<div class="tp-table-wrap">
			<table class="tp-table">
				<thead>
					<tr>
						<th>${tender_escape(__("WBS"))}</th>
						<th>${tender_escape(__("Activity"))}</th>
						<th class="tp-number">${tender_escape(__("Days"))}</th>
						<th>${tender_escape(__("Start"))}</th>
						<th>${tender_escape(__("Finish"))}</th>
						<th>${tender_escape(__("Status"))}</th>
					</tr>
				</thead>
				<tbody>${table_rows}</tbody>
			</table>
		</div>
		${remaining ? `<div class="tp-section-note" style="margin-top:8px;">${tender_escape(__("+ {0} more schedule activity(ies)", [remaining]))}</div>` : ""}`;
}

function build_presentation_organization_section(frm) {
	const rows = frm.doc.organization_roles || [];
	if (!rows.length) {
		return tender_empty_state(__("No organization roles yet."));
	}

	return `
		<div class="tp-card-grid">
			${rows.slice(0, 10).map((row) => `
				<div class="tp-role-card">
					<div class="tp-card-title">
						<span>${tender_escape(row.role_title || row.role_code || __("Role"))}</span>
						<span class="tp-pill">${tender_escape(row.headcount || 0)} ${tender_escape(__("HC"))}</span>
					</div>
					<div class="tp-card-body">
						${tender_escape([row.location, row.experience, row.reports_to ? __("Reports to {0}", [row.reports_to]) : null].filter(Boolean).join(" - "))}
					</div>
					${row.responsibilities ? `<div class="tp-card-body tp-muted" style="margin-top:8px;">${tender_escape(row.responsibilities)}</div>` : ""}
				</div>`).join("")}
		</div>
		${rows.length > 10 ? `<div class="tp-section-note" style="margin-top:8px;">${tender_escape(__("+ {0} more role(s)", [rows.length - 10]))}</div>` : ""}`;
}

function build_tender_presentation_html(frm) {
	const state = build_tender_health_state(frm);
	const readiness = tender_readiness_state(state);
	const title = frm.doc.tender_name_ar || frm.doc.tender_name || frm.doc.name || __("Tender Presentation");
	const subtitle = [
		frm.doc.tender_number ? __("Tender No. {0}", [frm.doc.tender_number]) : null,
		frm.doc.client_name,
		frm.doc.portal_source,
	].filter(Boolean).join(" - ");
	const currency = frm.doc.boq_currency || "";
	const ai_flags = state.dangerous_clauses + state.missing_information;
	const totals = tender_boq_totals(frm);

	return `
		<div class="tender-presentation">
			<section class="tp-cover">
				<span class="tp-kicker">${tender_escape(__("Tender Presentation Preview"))}</span>
				<h1 class="tp-title">${tender_escape(title)}</h1>
				<div class="tp-subtitle">${tender_escape(subtitle || __("Generated from Tender Workspace child tables."))}</div>
				<div class="tp-cover-grid">
					<div class="tp-cover-fact">
						<span class="tp-label">${tender_escape(__("Client"))}</span>
						<span class="tp-value">${tender_escape(frm.doc.client_name || __("Not set"))}</span>
					</div>
					<div class="tp-cover-fact">
						<span class="tp-label">${tender_escape(__("Deadline"))}</span>
						<span class="tp-value">${tender_escape(state.deadline.label)}</span>
					</div>
					<div class="tp-cover-fact">
						<span class="tp-label">${tender_escape(__("Readiness"))}</span>
						<span class="tp-value">${tender_escape(readiness.label)}</span>
					</div>
					<div class="tp-cover-fact">
						<span class="tp-label">${tender_escape(__("Status"))}</span>
						<span class="tp-value">${tender_escape(frm.doc.status || __("Draft"))}</span>
					</div>
				</div>
			</section>
			<div class="tp-body">
				<div class="tp-metrics">
					${tender_presentation_metric(
						__("Documents"),
						`${state.uploaded_documents}/${state.documents || 0}`,
						state.processing_documents ? __("{0} processing", [state.processing_documents]) : __("Uploaded source files"),
						state.failed_documents || state.ocr_documents ? "danger" : (state.uploaded_documents ? "success" : "warning")
					)}
					${tender_presentation_metric(
						__("AI Flags"),
						ai_flags,
						state.unresolved_ai_flags ? __("{0} unresolved", [state.unresolved_ai_flags]) : __("Ready for review"),
						state.dangerous_clauses ? "danger" : (state.missing_information ? "warning" : "success")
					)}
					${tender_presentation_metric(
						__("BOQ Lines"),
						state.boq_rows,
						state.unpriced_boq_lines ? __("{0} need rates", [state.unpriced_boq_lines]) : __("Pricing summary ready"),
						state.unpriced_boq_lines ? "warning" : (state.boq_rows ? "success" : "neutral")
					)}
					${tender_presentation_metric(
						__("Grand Total"),
						tender_format_money(totals.grand_total, currency),
						frm.doc.vat_rate ? __("Includes VAT {0}%", [frm.doc.vat_rate]) : __("VAT not configured"),
						totals.grand_total ? "success" : "neutral"
					)}
				</div>

				<section class="tp-section">
					<div class="tp-section-head">
						<h2>${tender_escape(__("AI Summary and Risks"))}</h2>
						<span class="tp-section-note">${tender_escape(__("Evidence-backed rows from AI Summary child table"))}</span>
					</div>
					${build_presentation_summary_cards(frm.doc.ai_summary || [])}
				</section>

				<section class="tp-section">
					<div class="tp-section-head">
						<h2>${tender_escape(__("BOQ Pricing Overview"))}</h2>
						<span class="tp-section-note">${tender_escape(__("Top pricing lines with totals"))}</span>
					</div>
					${build_presentation_boq_section(frm)}
				</section>

				<section class="tp-section">
					<div class="tp-section-head">
						<h2>${tender_escape(__("Proposal Sections"))}</h2>
						<span class="tp-section-note">${tender_escape(__("Generated content from Proposal Sections child table"))}</span>
					</div>
					<div class="tp-card-grid">${build_presentation_proposal_sections(frm)}</div>
				</section>

				<section class="tp-section">
					<div class="tp-section-head">
						<h2>${tender_escape(__("Schedule Snapshot"))}</h2>
						<span class="tp-section-note">${tender_escape(__("Baseline schedule child table"))}</span>
					</div>
					${build_presentation_schedule_section(frm)}
				</section>

				<section class="tp-section">
					<div class="tp-section-head">
						<h2>${tender_escape(__("Organization Snapshot"))}</h2>
						<span class="tp-section-note">${tender_escape(__("Organization roles child table"))}</span>
					</div>
					${build_presentation_organization_section(frm)}
				</section>
			</div>
		</div>`;
}

function tender_print_presentation(html, title) {
	const print_window = window.open("", "_blank");
	if (!print_window) {
		frappe.msgprint({
			title: __("Popup blocked"),
			indicator: "orange",
			message: __("Allow popups for this site, then try Print again."),
		});
		return;
	}
	print_window.document.write(`
		<!doctype html>
		<html>
			<head>
				<meta charset="utf-8">
				<title>${tender_escape(title)}</title>
				<style>${tender_presentation_css()}</style>
			</head>
			<body>${html}</body>
		</html>`);
	print_window.document.close();
	print_window.focus();
	setTimeout(() => print_window.print(), 250);
}

function show_tender_presentation_preview(frm) {
	const title = frm.doc.tender_name || frm.doc.tender_name_ar || frm.doc.name || __("Tender Presentation");
	const html = build_tender_presentation_html(frm);
	const dialog = new frappe.ui.Dialog({
		title: __("Tender Presentation Preview"),
		size: "extra-large",
		fields: [
			{
				fieldtype: "HTML",
				fieldname: "preview",
			},
		],
	});
	dialog.fields_dict.preview.$wrapper.html(html);
	dialog.set_primary_action(__("Print"), () => tender_print_presentation(html, title));
	dialog.$wrapper.addClass("tender-presentation-dialog");
	dialog.show();
}

// Draw the Tender Health Dashboard above the workspace tabs.
function render_tender_dashboard(frm) {
	const state = build_tender_health_state(frm);
	const readiness = tender_readiness_state(state);
	const actions = build_tender_actions(state);
	const title = frm.doc.tender_name_ar || frm.doc.tender_name || frm.doc.name || __("New Tender Workspace");
	const subtitle_parts = [
		frm.doc.tender_number ? __("Tender No. {0}", [frm.doc.tender_number]) : null,
		frm.doc.client_name || null,
		frm.doc.closing_date ? __("Closes {0}", [frappe.datetime.str_to_user(frm.doc.closing_date)]) : null,
	].filter(Boolean);
	const status = frm.doc.status || "Draft";
	const document_tone = state.failed_documents || state.ocr_documents
		? "danger"
		: (state.processing_documents
			? "info"
			: (state.uploaded_documents ? (state.has_analysis ? "success" : "warning") : "neutral"));
	const document_detail = state.failed_documents || state.ocr_documents
		? __("{0} failed, {1} need OCR", [state.failed_documents, state.ocr_documents])
		: (state.processing_documents
			? __("{0} processing", [state.processing_documents])
			: (state.has_analysis
				? __("{0} analyzed", [state.analyzed_documents || state.uploaded_documents])
				: (state.uploaded_documents ? __("Uploaded; extraction pending") : __("No documents uploaded"))));
	const ai_flags = state.dangerous_clauses + state.missing_information;
	const ai_tone = state.dangerous_clauses ? "danger" : (state.missing_information ? "warning" : (state.has_analysis ? "success" : "neutral"));
	const boq_tone = state.unpriced_boq_lines ? "warning" : (state.priceable_boq_lines ? "success" : "neutral");
	const proposal_tone = state.pending_proposal_sections ? "warning" : (state.proposal_sections ? "success" : "neutral");
	const review_tone = state.review_total && state.reviewed_items >= state.review_total
		? "success"
		: (state.review_total ? "warning" : "neutral");
	const document_value = state.documents ? `${state.uploaded_documents}/${state.documents}` : "0";

	const html = `
		<div class="tender-desk-dashboard">
			<div class="tender-health-dashboard">
				<div class="tender-health-header">
					<div class="tender-health-title">
						<span class="tender-kicker">${tender_escape(__("Tender Workspace"))}</span>
						<strong>${tender_escape(title)}</strong>
						<div class="tender-health-subtitle">
							${tender_escape(subtitle_parts.join(" / ") || __("No tender metadata yet"))}
						</div>
						<div class="tender-health-subtitle">
							${tender_escape(readiness.detail)}
						</div>
					</div>
					<div class="tender-health-status">
						<span class="tender-readiness-pill tender-health-${readiness.tone}">
							${tender_escape(readiness.label)}
						</span>
						<span class="tender-deadline-pill tender-health-${state.deadline.tone}">
							${tender_escape(state.deadline.label)}
						</span>
						<span class="tender-status-chip tender-status-${tender_css_class(status)}">${tender_escape(__(status))}</span>
						<button type="button" class="btn btn-default btn-sm tender-preview-trigger" data-tender-preview="1">
							${tender_icon("file", "xs")} ${tender_escape(__("Preview Presentation"))}
						</button>
					</div>
				</div>
				<div class="tender-health-body">
					<div class="tender-health-metrics">
						${tender_health_metric(
							__("Documents"),
							document_value,
							document_detail,
							document_tone
						)}
						${tender_health_metric(
							__("AI Risks"),
							ai_flags,
							state.unresolved_ai_flags
								? __("{0} unresolved flag(s)", [state.unresolved_ai_flags])
								: __("No unresolved risk flags"),
							ai_tone
						)}
						${tender_health_metric(
							__("BOQ Rates"),
							state.priceable_boq_lines ? `${state.priced_boq_lines}/${state.priceable_boq_lines}` : "0",
							state.unpriced_boq_lines
								? __("{0} line(s) need rates", [state.unpriced_boq_lines])
								: (state.priceable_boq_lines ? __("All priceable lines rated") : __("No BOQ lines extracted")),
							boq_tone
						)}
						${tender_health_metric(
							__("Proposal"),
							state.proposal_sections ? `${state.generated_proposals}/${state.proposal_sections}` : "0",
							state.pending_proposal_sections
								? __("{0} section(s) need content", [state.pending_proposal_sections])
								: (state.proposal_sections ? __("Proposal sections generated") : __("No proposal sections yet")),
							proposal_tone
						)}
						${tender_health_metric(
							__("Review"),
							state.review_total ? `${state.reviewed_items}/${state.review_total}` : "0",
							state.review_total ? __("Confirmed AI and proposal items") : __("No review items yet"),
							review_tone
						)}
						${tender_health_metric(
							__("Deadline"),
							state.deadline.label,
							state.deadline.detail,
							state.deadline.tone
						)}
					</div>
					<div class="tender-next-actions">
						<div class="tender-actions-title">
							<span class="tender-health-label">${tender_escape(__("Next Actions"))}</span>
							<span class="tender-health-label">${tender_escape(__("Priority"))}</span>
						</div>
						<div class="tender-actions-list">
							${actions.map(tender_action_item).join("")}
						</div>
					</div>
				</div>
				<div class="tender-ai-review-note">
					<span class="tender-action-icon tender-action-info">${tender_icon("search", "sm")}</span>
					<span>${tender_escape(__("AI-generated extraction, BOQ, and proposal content can contain mistakes. Review the evidence-backed rows before submission."))}</span>
				</div>
			</div>
		</div>
	`;

	frm.dashboard.set_headline(html);
	bind_tender_dashboard_actions(frm);
}

function highlight_document_rows(frm) {
	const grid = frm.fields_dict.uploaded_documents && frm.fields_dict.uploaded_documents.grid;
	if (!grid) return;
	setTimeout(() => {
		(grid.grid_rows || []).forEach((gr) => {
			if (!gr.row || !gr.doc) return;
			const classes = [];
			if (gr.doc.ai_status === "Failed") classes.push("tender-row-failed");
			if (gr.doc.ai_status === "Processing") classes.push("tender-row-processing");
			if (["Processed", "Extracted"].includes(gr.doc.ai_status)) classes.push("tender-row-processed");
			if (gr.doc.ai_status === "OCR Required" || gr.doc.readable_status === "OCR Required") {
				classes.push("tender-row-ocr");
			}
			mark_grid_row(gr, classes);
		});
	}, 300);
}

// Flag risk and review rows in the AI Summary grid without touching row data.
function highlight_summary_rows(frm) {
	const grid = frm.fields_dict.ai_summary && frm.fields_dict.ai_summary.grid;
	if (!grid) return;
	// Defer so the grid DOM is rendered before we touch it.
	setTimeout(() => {
		(grid.grid_rows || []).forEach((gr) => {
			if (!gr.row || !gr.doc) return;
			const classes = [];
			if (DANGER_TYPES.includes(gr.doc.summary_type)) classes.push("tender-row-danger");
			if (gr.doc.summary_type === "Missing Information") classes.push("tender-row-missing");
			if (gr.doc.confirmed) classes.push("tender-row-confirmed");
			mark_grid_row(gr, classes);
		});
	}, 300);
}

frappe.ui.form.on("Tender BOQ Item", {
	line_type(frm, cdt, cdn) {
		calculate_boq_total(frm, cdt, cdn);
	},

	quantity(frm, cdt, cdn) {
		calculate_boq_total(frm, cdt, cdn);
	},

	unit_price(frm, cdt, cdn) {
		calculate_boq_total(frm, cdt, cdn);
	},

	unit(frm) {
		render_tender_dashboard(frm);
		highlight_boq_rows(frm);
	},

	boq_items_add(frm) {
		render_tender_dashboard(frm);
		highlight_boq_rows(frm);
	},

	boq_items_remove(frm) {
		calculate_all_boq_totals(frm);
		render_tender_dashboard(frm);
		highlight_boq_rows(frm);
	},
});

frappe.ui.form.on("Tender Proposal Section", {
	status(frm) {
		render_tender_dashboard(frm);
	},
	content(frm) {
		render_tender_dashboard(frm);
	},
	confirmed(frm) {
		render_tender_dashboard(frm);
	},
	proposal_sections_add(frm) {
		render_tender_dashboard(frm);
	},
	proposal_sections_remove(frm) {
		render_tender_dashboard(frm);
	},
});

function calculate_boq_total(frm, cdt, cdn) {
	const row = locals[cdt][cdn];
	const total = is_priced_boq_item(row) ? flt(row.quantity) * flt(row.unit_price) : 0;
	frappe.model.set_value(cdt, cdn, "total", total);
	calculate_boq_summary(frm);
	render_tender_dashboard(frm);
	highlight_boq_rows(frm);
}

// Flag priceable rows that still have no unit price, and de-emphasise section
// headings so the grid reads as a real BOQ rather than a flat list.
function highlight_boq_rows(frm) {
	const grid = frm.fields_dict.boq_items && frm.fields_dict.boq_items.grid;
	if (!grid) return;
	setTimeout(() => {
		(grid.grid_rows || []).forEach((gr) => {
			if (!gr.row || !gr.doc) return;
			const is_heading = !is_priced_boq_item(gr.doc);
			const needs_price =
				!is_heading && flt(gr.doc.quantity) > 0 && flt(gr.doc.unit_price) === 0;
			const classes = [];
			if (is_heading) classes.push("tender-row-heading");
			if (needs_price) classes.push("tender-row-unpriced");
			mark_grid_row(gr, classes);
		});
	}, 300);
}

function calculate_all_boq_totals(frm, update_model = false) {
	let changed = false;
	(frm.doc.boq_items || []).forEach((row) => {
		const total = is_priced_boq_item(row) ? flt(row.quantity) * flt(row.unit_price) : 0;
		if (flt(row.total) !== total) {
			if (update_model) {
				frappe.model.set_value(row.doctype, row.name, "total", total);
			} else {
				row.total = total;
			}
			changed = true;
		}
	});
	if (changed && !update_model) {
		frm.refresh_field("boq_items");
	}
	calculate_boq_summary(frm);
}

function calculate_boq_summary(frm) {
	const subtotal = (frm.doc.boq_items || []).reduce((sum, row) => {
		return sum + (is_priced_boq_item(row) ? flt(row.quantity) * flt(row.unit_price) : 0);
	}, 0);
	const vat_rate = flt(frm.doc.vat_rate || 0);
	const vat_amount = subtotal * vat_rate / 100;
	frm.set_value("boq_subtotal", subtotal);
	frm.set_value("vat_amount", vat_amount);
	frm.set_value("boq_grand_total", subtotal + vat_amount);
}

function is_priced_boq_item(row) {
	return (row.line_type || "Item") !== "Section Heading";
}
