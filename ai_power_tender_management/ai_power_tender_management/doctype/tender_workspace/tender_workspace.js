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
		.tender-dashboard-hero {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 12px;
			align-items: center;
			padding: 14px 16px;
			border: 1px solid var(--tender-border);
			border-radius: 8px;
			background: var(--tender-surface);
			box-shadow: 0 8px 24px rgba(15, 23, 42, .06);
		}
		.tender-dashboard-title {
			min-width: 0;
		}
		.tender-kicker,
		.tender-metric-label {
			display: block;
			font-size: 11px;
			line-height: 1.2;
			font-weight: 700;
			letter-spacing: 0;
			text-transform: uppercase;
			color: var(--tender-muted);
		}
		.tender-dashboard-title strong {
			display: block;
			margin-top: 3px;
			font-size: 18px;
			line-height: 1.25;
			font-weight: 700;
			overflow-wrap: anywhere;
			unicode-bidi: plaintext;
			text-align: start;
		}
		.tender-dashboard-subtitle {
			margin-top: 3px;
			font-size: 12px;
			color: var(--tender-muted);
			unicode-bidi: plaintext;
			text-align: start;
		}
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
		.tender-metric-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
			gap: 10px;
			margin-top: 10px;
		}
		.tender-metric-card {
			position: relative;
			min-height: 78px;
			padding: 12px 12px 10px 14px;
			border: 1px solid var(--tender-border);
			border-radius: 8px;
			background: var(--tender-surface);
			box-shadow: 0 6px 18px rgba(15, 23, 42, .045);
			overflow: hidden;
		}
		.tender-metric-card:before {
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
		.tender-metric-value {
			display: block;
			margin-top: 7px;
			font-size: 21px;
			line-height: 1.15;
			font-weight: 750;
			color: var(--tender-card-color, var(--tender-ink));
			overflow-wrap: anywhere;
		}
		.tender-metric-detail {
			display: block;
			margin-top: 4px;
			font-size: 11px;
			line-height: 1.35;
			color: var(--tender-muted);
			overflow-wrap: anywhere;
		}
		.tender-ai-review-notice {
			display: flex;
			align-items: flex-start;
			gap: 8px;
			margin-top: 10px;
			padding: 9px 12px;
			border: 1px solid var(--yellow-200, #fde68a);
			border-radius: 8px;
			background: var(--yellow-50, #fffbeb);
			color: var(--yellow-800, #92400e);
			font-size: 12px;
			line-height: 1.45;
		}
		.tender-notice-mark {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 24px;
			height: 20px;
			border-radius: 6px;
			background: var(--yellow-100, #fef3c7);
			font-size: 10px;
			font-weight: 800;
			flex: none;
		}
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
			.tender-dashboard-hero {
				grid-template-columns: 1fr;
			}
			.tender-status-chip {
				justify-self: start;
			}
			.tender-metric-grid {
				grid-template-columns: repeat(2, minmax(0, 1fr));
			}
			.tender-workspace-form .frappe-control[data-fieldname="uploaded_documents"] .grid,
			.tender-workspace-form .frappe-control[data-fieldname="ai_summary"] .grid,
			.tender-workspace-form .frappe-control[data-fieldname="boq_items"] .grid {
				overflow-x: auto;
			}
		}
		@media (max-width: 480px) {
			.tender-metric-grid {
				grid-template-columns: 1fr;
			}
			.tender-dashboard-hero {
				padding: 12px;
			}
			.tender-metric-value {
				font-size: 19px;
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
	ai_status(frm) {
		render_tender_dashboard(frm);
		highlight_document_rows(frm);
	},
	readable_status(frm) {
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

function tender_metric_card(label, value, detail, tone) {
	return `
		<div class="tender-metric-card tender-card-${tone || "neutral"}">
			<span class="tender-metric-label">${tender_escape(label)}</span>
			<span class="tender-metric-value">${tender_escape(value)}</span>
			<span class="tender-metric-detail">${tender_escape(detail)}</span>
		</div>`;
}

function mark_grid_row(gr, classes) {
	if (!gr.row) return;
	gr.row.removeClass(TENDER_ROW_STATE_CLASSES);
	if (classes.length) gr.row.addClass(classes.join(" "));
}

// Draw a polished at-a-glance headline of the key tender numbers.
function render_tender_dashboard(frm) {
	const rows = frm.doc.ai_summary || [];
	const danger = rows.filter((r) => DANGER_TYPES.includes(r.summary_type)).length;
	const missing = rows.filter((r) => r.summary_type === "Missing Information").length;
	const confirmed = rows.filter((r) => r.confirmed).length;
	const boq_rows = frm.doc.boq_items || [];
	const priceable = boq_rows.filter((r) => is_priced_boq_item(r) && flt(r.quantity) > 0);
	const priced = priceable.filter((r) => flt(r.unit_price) > 0).length;
	const boq = boq_rows.filter((r) => is_priced_boq_item(r)).length;
	const proposals = (frm.doc.proposal_sections || []).length;
	const documents = frm.doc.uploaded_documents || [];
	const processing_docs = documents.filter((r) => r.ai_status === "Processing").length;
	const failed_docs = documents.filter((r) => {
		return ["Failed", "OCR Required"].includes(r.ai_status) || r.readable_status === "OCR Required";
	}).length;
	const all_priced = priceable.length > 0 && priced === priceable.length;
	const title = frm.doc.tender_name_ar || frm.doc.tender_name || frm.doc.name || __("New Tender Workspace");
	const subtitle_parts = [
		frm.doc.tender_number ? __("Tender No. {0}", [frm.doc.tender_number]) : null,
		frm.doc.client_name || null,
		frm.doc.closing_date ? __("Closes {0}", [frappe.datetime.str_to_user(frm.doc.closing_date)]) : null,
	].filter(Boolean);
	const status = frm.doc.status || "Draft";

	const document_tone = failed_docs ? "danger" : (processing_docs ? "info" : (documents.length ? "success" : "neutral"));
	const document_detail = failed_docs
		? __("{0} need attention", [failed_docs])
		: (processing_docs
			? __("{0} processing", [processing_docs])
			: (documents.length ? __("Ready for AI extraction") : __("No documents uploaded")));
	const ai_tone = danger ? "danger" : (missing ? "warning" : (rows.length ? "success" : "neutral"));
	const priced_tone = all_priced ? "success" : (priceable.length ? "warning" : "neutral");
	const confirmed_tone = confirmed === rows.length && rows.length ? "success" : (rows.length ? "warning" : "neutral");

	const html = `
		<div class="tender-desk-dashboard">
			<div class="tender-dashboard-hero">
				<div class="tender-dashboard-title">
					<span class="tender-kicker">${tender_escape(__("Tender Workspace"))}</span>
					<strong>${tender_escape(title)}</strong>
					<div class="tender-dashboard-subtitle">${tender_escape(subtitle_parts.join(" / ") || __("No tender metadata yet"))}</div>
				</div>
				<span class="tender-status-chip tender-status-${tender_css_class(status)}">${tender_escape(__(status))}</span>
			</div>
			<div class="tender-metric-grid">
				${tender_metric_card(
					__("Documents"),
					documents.length,
					document_detail,
					document_tone
				)}
				${tender_metric_card(
					__("AI Risks"),
					danger,
					missing ? __("{0} missing information items", [missing]) : __("No missing information flagged"),
					ai_tone
				)}
				${tender_metric_card(__("BOQ Items"), boq, __("Priceable tender lines"), boq ? "info" : "neutral")}
				${tender_metric_card(
					__("Priced"),
					`${priced}/${priceable.length}`,
					all_priced ? __("All priceable lines priced") : __("Review unpriced lines before submission"),
					priced_tone
				)}
				${tender_metric_card(__("Proposal"), proposals, __("Generated proposal sections"), proposals ? "info" : "neutral")}
				${tender_metric_card(
					__("Reviewed"),
					`${confirmed}/${rows.length}`,
					rows.length ? __("Confirmed AI summary rows") : __("No AI summary rows yet"),
					confirmed_tone
				)}
			</div>
			<div class="tender-ai-review-notice">
				<span class="tender-notice-mark">${tender_escape(__("AI"))}</span>
				<span>${tender_escape(__("AI-generated extraction, BOQ, and summary content can contain mistakes. Review the flagged rows before you proceed."))}</span>
			</div>
		</div>
	`;

	frm.dashboard.set_headline(html);
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
		highlight_boq_rows(frm);
	},

	boq_items_remove(frm) {
		calculate_all_boq_totals(frm);
		render_tender_dashboard(frm);
		highlight_boq_rows(frm);
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
