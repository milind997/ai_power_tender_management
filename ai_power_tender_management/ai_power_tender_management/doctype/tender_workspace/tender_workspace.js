// Copyright (c) 2026, milind and contributors
// For license information, please see license.txt

// Arabic (and other RTL) text in the BOQ / AI-summary grids must auto-align:
// `unicode-bidi: plaintext` picks direction from each cell's first strong
// character, so Arabic reads right-to-left while Latin text and numbers stay
// left-to-right — fixing mixed strings like "63 واقل". Injected once per session.
function inject_tender_rtl_styles() {
	if (document.getElementById("tender-rtl-style")) return;
	const fields = ["description", "description_en", "specification"];
	const summary_fields = ["extracted_text"];
	const sel = (grid, fname) =>
		`.frappe-control[data-fieldname="${grid}"] [data-fieldname="${fname}"],` +
		`.frappe-control[data-fieldname="${grid}"] [data-fieldname="${fname}"] input,` +
		`.frappe-control[data-fieldname="${grid}"] [data-fieldname="${fname}"] textarea`;
	const selectors = [
		...fields.map((f) => sel("boq_items", f)),
		...summary_fields.map((f) => sel("ai_summary", f)),
	].join(",");
	const style = document.createElement("style");
	style.id = "tender-rtl-style";
	style.textContent = `${selectors} { unicode-bidi: plaintext !important; text-align: start !important; }`;
	document.head.appendChild(style);
}

frappe.ui.form.on("Tender Workspace", {
	refresh(frm) {
		inject_tender_rtl_styles();

		// A compact at-a-glance summary works even for a brand-new record.
		render_tender_dashboard(frm);
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
				frappe.show_alert({
					message: `${data.message || __("Processing…")} (${data.progress || 0}%)`,
					indicator: data.progress >= 100 ? "green" : "blue",
				});
				if (data.reload) frm.reload_doc();
			});
		}

		const indicator_for_status = (status) => {
			return ["OCR Required", "AI Not Configured", "AI Failed", "Partial"].includes(status)
				? "orange"
				: "green";
		};

		// Run a whitelisted API method, then reload the form to show the result.
		const run = (method, freeze_message) => {
			frappe.call({
				method: `${API}.${method}`,
				args: { tender_workspace_name: frm.doc.name },
				freeze: true,
				freeze_message: freeze_message || __("Processing…"),
				callback: (r) => {
					const m = r.message || {};
					if (m.message) {
						frappe.show_alert({ message: m.message, indicator: indicator_for_status(m.status) });
					}
					// Exports return a downloadable file — open it in a new tab.
					if (m.file_url) {
						window.open(m.file_url, "_blank");
					}
					frm.reload_doc();
				},
			});
		};

		const proposal_sections = [
			{ label: __("Generate Scope Understanding"), section: "Scope Understanding" },
			{ label: __("Generate Methodology"), section: "Methodology" },
			{ label: __("Generate Implementation Plan"), section: "Implementation Plan" },
			{ label: __("Generate Primavera Timeline"), section: "Primavera Style Timeline" },
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
				freeze_message: __("Generating {0}…", [section]),
				callback: (r) => {
					const m = r.message || {};
					if (m.message) {
						frappe.show_alert({ message: m.message, indicator: indicator_for_status(m.status) });
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
		proposal_sections.forEach((item) => {
			frm.add_custom_button(
				item.label,
				() => run_section(item.section),
				__("Generate Section")
			);
		});

		// --- Export actions ---
		frm.add_custom_button(
			__("Export Technical Proposal"),
			() => run("export_technical_proposal", __("Preparing technical proposal…")),
			__("Export")
		);
		frm.add_custom_button(
			__("Export Financial Proposal"),
			() => run("export_financial_proposal", __("Preparing financial proposal…")),
			__("Export")
		);

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

frappe.ui.form.on("Tender AI Summary", {
	confirmed(frm) {
		render_tender_dashboard(frm);
	},
	summary_type(frm) {
		highlight_summary_rows(frm);
	},
	ai_summary_add(frm) {
		render_tender_dashboard(frm);
	},
	ai_summary_remove(frm) {
		render_tender_dashboard(frm);
	},
});

// Summary types that represent risk items worth flagging visually.
const DANGER_TYPES = ["Dangerous Clause", "Penalty Clause"];

// Draw a compact at-a-glance headline of the key tender numbers.
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
	const all_priced = priceable.length && priced === priceable.length;

	const pill = (label, value, color) => `
		<div style="display:flex;flex-direction:column;gap:2px;padding:8px 14px;border-radius:10px;
			background:var(--control-bg);border:1px solid var(--border-color);min-width:96px;">
			<span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">${label}</span>
			<span style="font-size:18px;font-weight:700;color:${color};">${value}</span>
		</div>`;

	const ai_notice = `
		<div style="display:flex;align-items:center;gap:6px;margin-top:8px;padding:6px 12px;border-radius:8px;
			background:var(--yellow-50, #fffbeb);border:1px solid var(--yellow-200, #fde68a);
			font-size:12px;color:var(--yellow-800, #92400e);">
			<span>⚠️</span>
			<span>${__("AI-generated content (extraction, BOQ, summaries) can contain mistakes — please review before you proceed.")}</span>
		</div>`;

	const html = `
		<div style="display:flex;flex-wrap:wrap;gap:10px;padding:4px 0;">
			${pill(__("Dangerous Clauses"), danger, danger ? "var(--red-500, #e53e3e)" : "var(--text-color)")}
			${pill(__("Missing Info"), missing, missing ? "var(--orange-500, #dd6b20)" : "var(--text-color)")}
			${pill(__("BOQ Items"), boq, "var(--text-color)")}
			${pill(__("Priced"), `${priced}/${priceable.length}`, all_priced ? "var(--green-600, #2f855a)" : (priceable.length ? "var(--orange-500, #dd6b20)" : "var(--text-color)"))}
			${pill(__("Proposal Sections"), proposals, "var(--text-color)")}
			${pill(__("Confirmed"), `${confirmed}/${rows.length}`, confirmed === rows.length && rows.length ? "var(--green-600, #2f855a)" : "var(--text-color)")}
		</div>
		${ai_notice}`;

	frm.dashboard.set_headline(html);
}

// Tint risk rows (Dangerous / Penalty clauses) red in the AI Summary grid.
function highlight_summary_rows(frm) {
	const grid = frm.fields_dict.ai_summary && frm.fields_dict.ai_summary.grid;
	if (!grid) return;
	// Defer so the grid DOM is rendered before we touch it.
	setTimeout(() => {
		(grid.grid_rows || []).forEach((gr) => {
			if (!gr.row || !gr.doc) return;
			const is_danger = DANGER_TYPES.includes(gr.doc.summary_type);
			gr.row.css("background-color", is_danger ? "rgba(229,62,62,.06)" : "");
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

// Flag priceable rows that still have no unit price (amber), and de-emphasise
// section headings so the grid reads as a real BOQ rather than a flat list.
function highlight_boq_rows(frm) {
	const grid = frm.fields_dict.boq_items && frm.fields_dict.boq_items.grid;
	if (!grid) return;
	setTimeout(() => {
		(grid.grid_rows || []).forEach((gr) => {
			if (!gr.row || !gr.doc) return;
			const is_heading = !is_priced_boq_item(gr.doc);
			const needs_price =
				!is_heading && flt(gr.doc.quantity) > 0 && flt(gr.doc.unit_price) === 0;
			gr.row.css({
				"background-color": needs_price ? "rgba(221,107,32,.08)" : "",
				"font-weight": is_heading ? "600" : "",
			});
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
