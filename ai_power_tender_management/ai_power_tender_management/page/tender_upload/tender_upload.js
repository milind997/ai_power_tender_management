frappe.pages["tender-upload"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Tender Upload"),
		single_column: true,
	});
	new frappe.TenderUpload.View(page);
};

frappe.provide("frappe.TenderUpload");

// API namespace ------------------------------------------------------------
frappe.TenderUpload.API = "ai_power_tender_management.api.tender_workspace";

// Card configuration for the three upload slots ----------------------------
frappe.TenderUpload.SLOTS = {
	tender: {
		document_type: "Tender Document",
		title: __("Tender Document / Terms & Specifications"),
		subtitle: __("Main tender document, RFP, terms, conditions, and specifications."),
		accept: ".pdf,.doc,.docx",
		accent: "indigo",
		icon: "file",
	},
	boq: {
		document_type: "BOQ",
		title: __("BOQ / Purchase Requisition"),
		subtitle: __("Bill of Quantities, purchase requisition, or pricing sheet."),
		accept: ".pdf,.xls,.xlsx,.csv",
		accent: "teal",
		icon: "sheet",
	},
	other: {
		document_type: "Other Attachment",
		title: __("Other Attachments"),
		subtitle: __("Drawings, addendums, client forms, catalogues, or additional tender files."),
		accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip",
		accent: "slate",
		icon: "attachment",
	},
};

// Status badge → colour class ----------------------------------------------
frappe.TenderUpload.BADGE = {
	"Not Uploaded": "gray",
	Uploaded: "blue",
	Processing: "orange",
	Processed: "green",
	Extracted: "green",
	"OCR Required": "yellow",
	Failed: "red",
	Unknown: "gray",
	Yes: "green",
};

frappe.TenderUpload.STEPS = [
	"Tender Info",
	"Upload Documents",
	"AI Summary",
	"BOQ",
	"Generate Proposal",
	"Export",
];

frappe.TenderUpload.View = class TenderUploadView {
	constructor(page) {
		this.page = page;
		this.$body = $(page.body);
		this.tender_name = null; // Tender Workspace docname once saved
		this.controls = {};
		this.loading = {};
		this.slots = {}; // slot -> { file_url, file_name, file_format, ai_status, readable_status, attached }
		for (const key of Object.keys(frappe.TenderUpload.SLOTS)) {
			this.slots[key] = this.empty_slot();
		}
		this.make();
	}

	empty_slot() {
		return {
			file_url: null,
			file_name: null,
			file_format: null,
			ai_status: "Not Uploaded",
			readable_status: "Unknown",
			attached: false,
		};
	}

	make() {
		this.inject_styles();
		this.render();
		this.build_form();
		for (const key of Object.keys(frappe.TenderUpload.SLOTS)) {
			this.bind_zone(key);
		}
		this.bind_actions();
		this.refresh_header();
		this.update_steps();
		this.update_action_state();
	}

	// -----------------------------------------------------------------------
	// Render skeleton
	// -----------------------------------------------------------------------
	render() {
		const steps = frappe.TenderUpload.STEPS.map((label, i) => {
			const sep = i > 0 ? '<span class="tu-step-sep">→</span>' : "";
			return `${sep}<span class="tu-step" data-step="${i}">${i + 1}. ${label}</span>`;
		}).join("");

		this.$body.html(`
			<div class="tu-wrap">
				<!-- Gradient hero + summary + steps -->
				<div class="tu-hero">
					<div class="tu-hero-inner">
						<div class="tu-hero-row">
							<div class="tu-hero-title-wrap">
								<div class="tu-hero-icon">${frappe.utils.icon("upload", "md")}</div>
								<div>
									<h2 class="tu-page-title">${__("Tender Upload")}</h2>
									<div class="tu-hero-sub">${__("Create a tender, upload the documents, and run the Phase 1 analysis.")}</div>
								</div>
							</div>
							<span class="tu-badge tu-badge-gray tu-header-status">${__("Draft")}</span>
						</div>
						<div class="tu-header-grid">
							<div><span class="tu-h-label">${__("Tender")}</span><span class="tu-h-value" data-h="tender_name">—</span></div>
							<div><span class="tu-h-label">${__("Client")}</span><span class="tu-h-value" data-h="client_name">—</span></div>
							<div><span class="tu-h-label">${__("Tender No")}</span><span class="tu-h-value" data-h="tender_number">—</span></div>
							<div><span class="tu-h-label">${__("Closing Date")}</span><span class="tu-h-value" data-h="closing_date">—</span></div>
						</div>
					</div>
					<div class="tu-steps-bar"><div class="tu-steps">${steps}</div></div>
				</div>

				<!-- Section 1: Tender Basic Info -->
				<div class="tu-card tu-section">
					<div class="tu-section-head">
						<h3 class="tu-section-title">${__("Tender Basic Info")}</h3>
						<button class="btn btn-primary btn-sm tu-save-inline">${__("Save Tender")}</button>
					</div>
					<div class="tu-form-grid"></div>
				</div>

				<!-- Section 2: Upload Documents -->
				<div class="tu-card tu-section">
					<div class="tu-section-head">
						<h3 class="tu-section-title">${__("Upload Documents")}</h3>
					</div>
					<div class="tu-uploads">
						<div class="tu-zone" data-slot="tender"></div>
						<div class="tu-zone" data-slot="boq"></div>
						<div class="tu-zone" data-slot="other"></div>
					</div>

					<!-- Section 4: Rules box -->
					<div class="tu-rules">
						<div class="tu-rules-title">${frappe.utils.icon("info", "sm")} ${__("Supported files")}</div>
						<div class="tu-rules-body">
							<div>${__("PDF, Excel, Word, CSV, ZIP.")}</div>
							<div class="tu-rules-note">
								${__(
									"Phase 1 supports clear digital PDFs. Scanned or image-based PDFs are not supported yet — if the system cannot read the PDF text, the file is marked as \"OCR Required\"."
								)}
							</div>
						</div>
					</div>
				</div>

				<!-- Section 3: Action buttons -->
				<div class="tu-actionbar">
					<button class="btn btn-primary tu-save">${frappe.utils.icon("es-line-add", "xs")} ${__("Save Tender")}</button>
					<button class="btn btn-default tu-analyze">${frappe.utils.icon("search", "xs")} ${__("Analyze Tender Document")}</button>
					<button class="btn btn-default tu-extract">${frappe.utils.icon("sheet", "xs")} ${__("Extract BOQ")}</button>
					<button class="btn btn-default tu-generate">${frappe.utils.icon("solid-success", "xs")} ${__("Generate Proposal Sections")}</button>
					<button class="btn btn-default tu-next">${__("Next: AI Summary")} ${frappe.utils.icon("right", "xs")}</button>
					<span class="tu-actionbar-spacer"></span>
					<button class="btn btn-default tu-export-tech">${frappe.utils.icon("download", "xs")} ${__("Export Technical")}</button>
					<button class="btn btn-default tu-export-fin">${frappe.utils.icon("download", "xs")} ${__("Export Financial")}</button>
					<button class="btn btn-default tu-reset">${__("Reset")}</button>
				</div>

				<!-- Section 5: Processing result -->
				<div class="tu-card tu-result hidden">
					<h3 class="tu-section-title">${__("Processing Result")}</h3>
					<div class="tu-result-grid">
						<div class="tu-result-row">
							<span class="tu-result-label">${__("Tender Document")}</span>
							<span class="tu-badge tu-badge-gray" data-r="tender_document_status">${__("Not Uploaded")}</span>
						</div>
						<div class="tu-result-row">
							<span class="tu-result-label">${__("BOQ")}</span>
							<span class="tu-badge tu-badge-gray" data-r="boq_status">${__("Not Uploaded")}</span>
						</div>
						<div class="tu-result-row">
							<span class="tu-result-label">${__("Tender Summary")}</span>
							<span class="tu-result-value" data-r="tender_summary">${__("Not Created")}</span>
						</div>
						<div class="tu-result-row">
							<span class="tu-result-label">${__("Dangerous Clauses")}</span>
							<span class="tu-result-value" data-r="dangerous_clauses_count">0</span>
						</div>
						<div class="tu-result-row">
							<span class="tu-result-label">${__("Missing Information")}</span>
							<span class="tu-result-value" data-r="missing_information_count">0</span>
						</div>
						<div class="tu-result-row">
							<span class="tu-result-label">${__("BOQ Items")}</span>
							<span class="tu-result-value" data-r="boq_items_count">0</span>
						</div>
						<div class="tu-result-row">
							<span class="tu-result-label">${__("Proposal Sections")}</span>
							<span class="tu-result-value" data-r="proposal_sections_count">0</span>
						</div>
					</div>
				</div>
			</div>
		`);
	}

	// -----------------------------------------------------------------------
	// Basic info form (native Frappe controls)
	// -----------------------------------------------------------------------
	build_form() {
		const $grid = this.$body.find(".tu-form-grid");
		const fields = [
			{ fieldtype: "Data", fieldname: "tender_name", label: __("Tender Name"), reqd: 1 },
			{ fieldtype: "Data", fieldname: "tender_number", label: __("Tender Number") },
			{ fieldtype: "Data", fieldname: "client_name", label: __("Client Name") },
			{
				fieldtype: "Select", fieldname: "portal_source", label: __("Portal Source"),
				options: ["", "Etimad", "NWC Portal", "SAP Ariba", "Other"].join("\n"),
			},
			{ fieldtype: "Date", fieldname: "closing_date", label: __("Closing Date") },
			{ fieldtype: "Link", fieldname: "reviewer", label: __("Reviewer"), options: "User" },
			{
				fieldtype: "Select", fieldname: "status", label: __("Status"), default: "Draft",
				options: [
					"Draft", "Documents Uploaded", "AI Analyzed", "BOQ Extracted",
					"Proposal Drafted", "Reviewed", "Submitted",
				].join("\n"),
			},
			{ fieldtype: "Small Text", fieldname: "notes", label: __("Notes") },
		];

		for (const df of fields) {
			const $cell = $(`<div class="tu-form-cell ${df.fieldtype === "Small Text" ? "tu-form-full" : ""}"></div>`).appendTo($grid);
			const control = frappe.ui.form.make_control({
				df: {
					...df,
					change: () => {
						this.refresh_header();
						this.update_steps();
					},
				},
				parent: $cell.get(0),
				render_input: true,
			});
			control.set_value(df.default || "");
			this.controls[df.fieldname] = control;
		}
		// keep header in sync on any keystroke too
		$grid.on("change keyup", "input, textarea", () => this.refresh_header());
	}

	get_form_values() {
		const data = {};
		for (const [name, control] of Object.entries(this.controls)) {
			data[name] = control.get_value();
		}
		if (this.tender_name) data.name = this.tender_name;
		return data;
	}

	// -----------------------------------------------------------------------
	// Upload zones
	// -----------------------------------------------------------------------
	zone_template(slot, cfg) {
		return `
			<div class="tu-upcard tu-accent-${cfg.accent}">
				<div class="tu-upcard-head">
					<span class="tu-upcard-icon">${frappe.utils.icon(cfg.icon, "sm")}</span>
					<div class="tu-upcard-headtext">
						<div class="tu-upcard-title">${cfg.title}</div>
						<div class="tu-upcard-sub">${cfg.subtitle}</div>
					</div>
				</div>

				<div class="tu-drop" tabindex="0" role="button">
					<input type="file" class="tu-input" accept="${cfg.accept}" hidden />
					<div class="tu-drop-empty">
						<div class="tu-drop-icon">${frappe.utils.icon("upload", "md")}</div>
						<div class="tu-drop-text"><strong>${__("Click to browse")}</strong> ${__("or drag & drop")}</div>
						<div class="tu-drop-accept">${cfg.accept.split(",").map((x) => x.replace(".", "").toUpperCase()).join(" · ")}</div>
					</div>
					<div class="tu-progress hidden"><div class="tu-progress-bar"></div></div>
				</div>

				<div class="tu-file hidden">
					<div class="tu-file-row">
						<span class="tu-file-name"></span>
						<button class="tu-file-remove" title="${__("Remove")}">${frappe.utils.icon("close", "sm")}</button>
					</div>
					<div class="tu-file-meta">
						<span class="tu-file-type"></span>
						<span class="tu-badge tu-badge-blue tu-file-status">${__("Uploaded")}</span>
						<span class="tu-badge tu-badge-gray tu-file-readable">${__("Unknown")}</span>
					</div>
				</div>
			</div>
		`;
	}

	bind_zone(slot) {
		const cfg = frappe.TenderUpload.SLOTS[slot];
		const $zone = this.$body.find(`.tu-zone[data-slot="${slot}"]`);
		$zone.html(this.zone_template(slot, cfg));

		const $drop = $zone.find(".tu-drop");
		const $input = $zone.find(".tu-input");

		$drop.on("click", () => $input.trigger("click"));
		$drop.on("keypress", (e) => {
			if (e.key === "Enter" || e.key === " ") $input.trigger("click");
		});
		$input.on("change", (e) => {
			if (e.target.files.length) this.handle_file(slot, e.target.files[0]);
		});
		$drop.on("dragover dragenter", (e) => {
			e.preventDefault();
			e.stopPropagation();
			$drop.addClass("is-dragover");
		});
		$drop.on("dragleave dragend drop", (e) => {
			e.preventDefault();
			e.stopPropagation();
			$drop.removeClass("is-dragover");
		});
		$drop.on("drop", (e) => {
			const files = e.originalEvent.dataTransfer.files;
			if (files.length) this.handle_file(slot, files[0]);
		});
		$zone.on("click", ".tu-file-remove", (e) => {
			e.stopPropagation();
			this.clear_file(slot);
		});
	}

	async handle_file(slot, file) {
		const cfg = frappe.TenderUpload.SLOTS[slot];
		const $zone = this.$body.find(`.tu-zone[data-slot="${slot}"]`);
		try {
			const doc = await this.upload_to_frappe(slot, file);
			const fmt = (file.name.split(".").pop() || "").toLowerCase();
			this.slots[slot] = {
				file_url: doc.file_url,
				file_name: file.name,
				file_format: fmt,
				ai_status: "Uploaded",
				readable_status: "Unknown",
				attached: false,
			};
			this.render_file(slot);

			// If tender already saved, link the file immediately.
			if (this.tender_name) {
				await this.attach_slot(slot);
			}
			this.update_action_state();
		} catch (err) {
			console.error(err);
			$zone.find(".tu-drop").addClass("has-error");
			frappe.show_alert({ message: __("Upload failed"), indicator: "red" });
		}
	}

	upload_to_frappe(slot, file) {
		const $zone = this.$body.find(`.tu-zone[data-slot="${slot}"]`);
		const $progress = $zone.find(".tu-progress").removeClass("hidden");
		const $bar = $zone.find(".tu-progress-bar");

		return new Promise((resolve, reject) => {
			const form = new FormData();
			form.append("file", file, file.name);
			form.append("is_private", 1);
			form.append("folder", "Home");

			const xhr = new XMLHttpRequest();
			xhr.open("POST", "/api/method/upload_file", true);
			xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);
			xhr.setRequestHeader("Accept", "application/json");
			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) $bar.css("width", Math.round((e.loaded / e.total) * 100) + "%");
			};
			xhr.onload = () => {
				$progress.addClass("hidden");
				if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText).message);
				else reject(new Error("Upload failed: " + xhr.status));
			};
			xhr.onerror = () => reject(new Error("Network error"));
			xhr.send(form);
		});
	}

	async attach_slot(slot) {
		const s = this.slots[slot];
		if (!s.file_url || s.attached || !this.tender_name) return;
		const cfg = frappe.TenderUpload.SLOTS[slot];
		const row = await this.call("attach_tender_file", {
			tender_workspace_name: this.tender_name,
			document_type: cfg.document_type,
			file_url: s.file_url,
			file_name: s.file_name,
			file_format: s.file_format,
		});
		if (row) s.attached = true;
	}

	render_file(slot) {
		const s = this.slots[slot];
		const $zone = this.$body.find(`.tu-zone[data-slot="${slot}"]`);
		$zone.find(".tu-drop-empty").addClass("hidden");
		$zone.find(".tu-drop").addClass("has-file");
		$zone.find(".tu-file").removeClass("hidden");
		$zone.find(".tu-file-name").text(s.file_name || "");
		$zone.find(".tu-file-type").text((s.file_format || "").toUpperCase());
		this.set_badge($zone.find(".tu-file-status"), s.ai_status);
		this.set_badge($zone.find(".tu-file-readable"), s.readable_status);
	}

	clear_file(slot) {
		this.slots[slot] = this.empty_slot();
		const $zone = this.$body.find(`.tu-zone[data-slot="${slot}"]`);
		$zone.find(".tu-input").val("");
		$zone.find(".tu-drop-empty").removeClass("hidden");
		$zone.find(".tu-drop").removeClass("has-file has-error");
		$zone.find(".tu-file").addClass("hidden");
		this.update_action_state();
	}

	// -----------------------------------------------------------------------
	// Actions
	// -----------------------------------------------------------------------
	bind_actions() {
		this.$body.find(".tu-save, .tu-save-inline").on("click", () => this.save_tender());
		this.$body.find(".tu-analyze").on("click", () => this.analyze());
		this.$body.find(".tu-extract").on("click", () => this.extract_boq());
		this.$body.find(".tu-generate").on("click", () => this.generate_proposal());
		this.$body.find(".tu-export-tech").on("click", () => this.export_proposal("technical"));
		this.$body.find(".tu-export-fin").on("click", () => this.export_proposal("financial"));
		this.$body.find(".tu-next").on("click", () => this.next_ai_summary());
		this.$body.find(".tu-reset").on("click", () => this.reset());
	}

	async save_tender() {
		const values = this.get_form_values();
		if (!values.tender_name) {
			frappe.show_alert({ message: __("Tender Name is required."), indicator: "red" });
			return;
		}
		if (!values.client_name) {
			frappe.show_alert({ message: __("Tip: add a Client Name for a complete record."), indicator: "orange" });
		}

		this.set_loading(".tu-save, .tu-save-inline", true, __("Saving…"));
		const res = await this.call("save_tender_workspace", { data: JSON.stringify(values) });
		this.set_loading(".tu-save, .tu-save-inline", false, __("Save Tender"));
		if (!res) return;

		this.tender_name = res.name;
		this.page.set_indicator(res.name, "blue");
		frappe.show_alert({ message: res.message || __("Tender saved"), indicator: "green" });

		// Link any files uploaded before the tender was saved.
		for (const slot of Object.keys(this.slots)) {
			await this.attach_slot(slot);
		}
		if (res.status) this.controls.status.set_value(res.status);
		this.refresh_header();
		this.update_steps();
		this.update_action_state();
		this.refresh_summary();
	}

	async analyze() {
		if (!this.ensure_saved()) return;
		if (!this.slots.tender.file_url) {
			frappe.msgprint({ message: __("Please upload Tender Document / Terms & Specifications first."), indicator: "red", title: __("Missing document") });
			return;
		}
		await this.attach_slot("tender");
		this.set_loading(".tu-analyze", true, __("Analyzing…"));
		const res = await this.call("analyze_tender_document", { tender_workspace_name: this.tender_name });
		this.set_loading(".tu-analyze", false, __("Analyze Tender Document"));
		if (!res) return;

		// Background OCR pipeline: reflect "Processing" and poll for completion.
		if (res.status === "Processing") {
			this.slots.tender.ai_status = "Processing";
			this.render_file("tender");
			frappe.show_alert({ message: res.message, indicator: "blue" });
			this.start_poll();
			return;
		}

		// reflect on the tender card
		this.slots.tender.ai_status = res.status;
		this.slots.tender.readable_status = res.status === "OCR Required" ? "OCR Required" : "Yes";
		this.render_file("tender");

		const indicator = res.status === "OCR Required" ? "orange" : "green";
		frappe.show_alert({ message: res.message, indicator });
		this.refresh_header();
		this.update_steps();
		this.refresh_summary();
	}

	async extract_boq() {
		if (!this.ensure_saved()) return;
		if (!this.slots.boq.file_url) {
			frappe.msgprint({ message: __("Please upload BOQ / Purchase Requisition first."), indicator: "red", title: __("Missing document") });
			return;
		}
		await this.attach_slot("boq");
		this.set_loading(".tu-extract", true, __("Extracting…"));
		const res = await this.call("extract_boq", { tender_workspace_name: this.tender_name });
		this.set_loading(".tu-extract", false, __("Extract BOQ"));
		if (!res) return;

		// Background OCR pipeline: reflect "Processing" and poll for completion.
		if (res.status === "Processing") {
			this.slots.boq.ai_status = "Processing";
			this.render_file("boq");
			frappe.show_alert({ message: res.message, indicator: "blue" });
			this.start_poll();
			return;
		}

		this.slots.boq.ai_status = res.status;
		this.slots.boq.readable_status = res.status === "OCR Required" ? "OCR Required" : "Yes";
		this.render_file("boq");

		const indicator = res.status === "OCR Required" ? "orange" : "green";
		frappe.show_alert({ message: `${res.message} (${res.items_count} ${__("items")})`, indicator });
		this.refresh_header();
		this.update_steps();
		this.refresh_summary();
	}

	// Poll the server while a background OCR pipeline is running, then refresh.
	start_poll() {
		if (this._poll) return;
		let tries = 0;
		this._poll = setInterval(async () => {
			tries += 1;
			const s = await this.call("get_processing_summary", { tender_workspace_name: this.tender_name });
			if (s) {
				// Update the card badges from server-side statuses.
				for (const [slot, status] of [
					["tender", s.tender_document_status],
					["boq", s.boq_status],
				]) {
					if (this.slots[slot].file_url) {
						this.slots[slot].ai_status = status;
						this.render_file(slot);
					}
				}
				this.render_result(s);
				const busy = s.tender_document_status === "Processing" || s.boq_status === "Processing";
				if (!busy || tries > 45) {
					clearInterval(this._poll);
					this._poll = null;
					this.refresh_header();
					this.update_steps();
					if (!busy) frappe.show_alert({ message: __("Background processing finished."), indicator: "green" });
				}
			}
		}, 8000);
	}

	async generate_proposal() {
		if (!this.ensure_saved()) return;
		this.set_loading(".tu-generate", true, __("Generating…"));
		const res = await this.call("generate_proposal_sections", { tender_workspace_name: this.tender_name });
		this.set_loading(".tu-generate", false, __("Generate Proposal Sections"));
		if (!res) return;
		frappe.show_alert({ message: `${res.message} (${res.sections_count})`, indicator: "green" });
		this.update_steps();
		this.refresh_summary();
	}

	async export_proposal(kind) {
		if (!this.ensure_saved()) return;
		const method = kind === "financial" ? "export_financial_proposal" : "export_technical_proposal";
		const sel = kind === "financial" ? ".tu-export-fin" : ".tu-export-tech";
		const label = kind === "financial" ? __("Export Financial") : __("Export Technical");
		this.set_loading(sel, true, __("Preparing…"));
		const res = await this.call(method, { tender_workspace_name: this.tender_name });
		this.set_loading(sel, false, label);
		if (!res) return;
		let msg = res.message;
		if (kind === "financial" && res.grand_total != null) {
			msg += ` — ${__("Total")}: ${format_currency(res.grand_total)}`;
		}
		frappe.show_alert({ message: msg, indicator: "green" });
		// Download the generated file.
		if (res.file_url) {
			window.open(res.file_url, "_blank");
		}
	}

	next_ai_summary() {
		// Phase 1: the AI Summary page does not exist yet.
		frappe.msgprint({
			title: __("Coming soon"),
			indicator: "blue",
			message: __("AI Summary page will be implemented in next step."),
		});
	}

	reset() {
		for (const slot of Object.keys(this.slots)) this.clear_file(slot);
		for (const control of Object.values(this.controls)) control.set_value("");
		this.controls.status.set_value("Draft");
		this.tender_name = null;
		this.page.clear_indicator && this.page.clear_indicator();
		this.$body.find(".tu-result").addClass("hidden");
		this.refresh_header();
		this.update_steps();
		this.update_action_state();
	}

	// -----------------------------------------------------------------------
	// Processing result
	// -----------------------------------------------------------------------
	async refresh_summary() {
		if (!this.tender_name) return;
		const s = await this.call("get_processing_summary", { tender_workspace_name: this.tender_name });
		if (s) this.render_result(s);
	}

	render_result(s) {
		const $r = this.$body.find(".tu-result").removeClass("hidden");
		this.set_badge($r.find('[data-r="tender_document_status"]'), s.tender_document_status);
		this.set_badge($r.find('[data-r="boq_status"]'), s.boq_status);
		$r.find('[data-r="tender_summary"]').text(s.tender_summary_created ? __("Created") : __("Not Created"));
		$r.find('[data-r="dangerous_clauses_count"]').text(s.dangerous_clauses_count);
		$r.find('[data-r="missing_information_count"]').text(s.missing_information_count);
		$r.find('[data-r="boq_items_count"]').text(s.boq_items_count);
		$r.find('[data-r="proposal_sections_count"]').text(s.proposal_sections_count || 0);
	}

	// -----------------------------------------------------------------------
	// Header + steps
	// -----------------------------------------------------------------------
	refresh_header() {
		const v = (name) => (this.controls[name] ? this.controls[name].get_value() : "") || "—";
		this.$body.find('[data-h="tender_name"]').text(v("tender_name"));
		this.$body.find('[data-h="client_name"]').text(v("client_name"));
		this.$body.find('[data-h="tender_number"]').text(v("tender_number"));
		this.$body.find('[data-h="closing_date"]').text(
			this.controls.closing_date && this.controls.closing_date.get_value()
				? frappe.datetime.str_to_user(this.controls.closing_date.get_value())
				: "—"
		);
		const status = (this.controls.status && this.controls.status.get_value()) || "Draft";
		this.set_badge(this.$body.find(".tu-header-status"), status, status);
	}

	update_steps() {
		const status = (this.controls.status && this.controls.status.get_value()) || "Draft";
		const done = new Set();
		if (this.tender_name) done.add(0); // Tender Info
		if (Object.values(this.slots).some((s) => s.file_url)) done.add(1); // Upload
		if (["AI Analyzed", "BOQ Extracted", "Proposal Drafted", "Reviewed", "Submitted"].includes(status)) done.add(2);
		if (["BOQ Extracted", "Proposal Drafted", "Reviewed", "Submitted"].includes(status)) done.add(3);

		this.$body.find(".tu-step").each((i, el) => {
			const $el = $(el);
			$el.toggleClass("is-done", done.has(i));
			$el.toggleClass("is-active", i === 1); // Upload Documents is the current step
		});
	}

	update_action_state() {
		this.$body.find(".tu-analyze").prop("disabled", !this.slots.tender.file_url);
		this.$body.find(".tu-extract").prop("disabled", !this.slots.boq.file_url);
	}

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------
	ensure_saved() {
		if (!this.tender_name) {
			frappe.msgprint({ message: __("Please Save the Tender first."), indicator: "red", title: __("Not saved") });
			return false;
		}
		return true;
	}

	set_badge($el, value, label) {
		const colour = frappe.TenderUpload.BADGE[value] || "gray";
		$el.attr("class", $el.attr("class").replace(/tu-badge-\w+/g, "") + ` tu-badge-${colour}`);
		$el.text(__(label || value || ""));
	}

	set_loading(selector, on, text) {
		const $btn = this.$body.find(selector);
		$btn.prop("disabled", on);
		if (text) $btn.text(text);
	}

	call(method, args) {
		return frappe
			.call({ method: `${frappe.TenderUpload.API}.${method}`, args })
			.then((r) => r.message)
			.catch((e) => {
				console.error(method, e);
				return null;
			});
	}

	// -----------------------------------------------------------------------
	// Styles
	// -----------------------------------------------------------------------
	inject_styles() {
		if (document.getElementById("tender-upload-styles")) return;
		const css = `
			.tu-wrap {
				--tu-indigo: #6366f1; --tu-teal: #14b8a6; --tu-slate: #64748b;
				max-width: 1100px; margin: 0 auto; padding: 8px 12px 48px;
				display: flex; flex-direction: column; gap: 18px;
			}
			.tu-card, .tu-actionbar {
				background: var(--card-bg); border: 1px solid var(--border-color);
				border-radius: 14px; box-shadow: 0 1px 2px rgba(0,0,0,.04);
			}
			.tu-card { padding: 22px 24px; }

			/* Gradient hero */
			.tu-hero {
				border-radius: 16px; overflow: hidden; border: 1px solid var(--border-color);
				box-shadow: 0 18px 40px -24px rgba(79,70,229,.55);
			}
			.tu-hero-inner {
				position: relative; padding: 24px 26px; color: #fff;
				background: linear-gradient(120deg, #4f46e5 0%, #7c3aed 55%, #6366f1 100%);
			}
			.tu-hero-inner::after {
				content: ""; position: absolute; inset: 0; pointer-events: none;
				background:
					radial-gradient(circle at 90% 10%, rgba(255,255,255,.22), transparent 42%),
					radial-gradient(circle at 8% 120%, rgba(255,255,255,.16), transparent 45%);
			}
			.tu-hero-row { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
			.tu-hero-title-wrap { display: flex; align-items: center; gap: 14px; }
			.tu-hero-icon {
				flex: 0 0 auto; width: 48px; height: 48px; border-radius: 13px;
				display: flex; align-items: center; justify-content: center;
				background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.3); backdrop-filter: blur(3px);
			}
			.tu-hero-icon .icon { stroke: #fff; width: 24px; height: 24px; }
			.tu-page-title { margin: 0; font-size: 23px; font-weight: 700; letter-spacing: -.02em; color: #fff; }
			.tu-hero-sub { font-size: 13px; color: rgba(255,255,255,.82); margin-top: 3px; }
			.tu-header-grid {
				position: relative; z-index: 1;
				display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 24px;
				margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.2);
			}
			@media (max-width: 720px) { .tu-header-grid { grid-template-columns: 1fr 1fr; } }
			.tu-h-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.65); margin-bottom: 4px; }
			.tu-h-value { font-size: 14px; font-weight: 600; color: #fff; }

			/* Steps bar */
			.tu-steps-bar { background: var(--card-bg); padding: 13px 18px; }
			.tu-steps { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
			.tu-step { font-size: 12px; font-weight: 500; color: var(--text-muted); padding: 5px 12px; border-radius: 999px; background: var(--control-bg); transition: all .15s; }
			.tu-step.is-active { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; box-shadow: 0 6px 14px -8px rgba(79,70,229,.8); }
			.tu-step.is-done { color: var(--green-600, #2f855a); background: var(--green-100, #e6f7ee); }
			.tu-step-sep { color: var(--text-muted); font-size: 12px; opacity: .6; }

			/* Sections */
			.tu-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
			.tu-section-title { margin: 0; font-size: 16px; font-weight: 650; position: relative; padding-left: 12px; }
			.tu-section-title::before { content: ""; position: absolute; left: 0; top: 2px; bottom: 2px; width: 4px; border-radius: 3px; background: linear-gradient(180deg, var(--tu-indigo), var(--tu-teal)); }

			/* Clean up native form controls (remove heavy grey fills) */
			.tu-form-grid .frappe-control { margin: 0; }
			.tu-form-grid .control-label { font-size: 12px; font-weight: 500; color: var(--text-muted); margin-bottom: 6px; }
			.tu-form-grid .form-control,
			.tu-form-grid input.form-control,
			.tu-form-grid select.form-control,
			.tu-form-grid textarea.form-control {
				background: var(--card-bg) !important; border: 1px solid var(--border-color) !important;
				border-radius: 8px; box-shadow: none;
			}
			.tu-form-grid input.form-control, .tu-form-grid select.form-control, .tu-form-grid .awesomplete { height: 36px; }
			.tu-form-grid .awesomplete input.form-control { height: 36px; }
			.tu-form-grid textarea.form-control { min-height: 88px; }
			.tu-form-grid .form-control:focus {
				border-color: var(--tu-indigo) !important; box-shadow: 0 0 0 3px rgba(99,102,241,.15) !important;
			}

			/* Save Tender emphasis (inline + action bar) */
			.tu-save-inline, .tu-actionbar .btn-primary {
				background: linear-gradient(135deg, #4f46e5, #7c3aed) !important; border: none !important; color: #fff !important;
				box-shadow: 0 8px 18px -10px rgba(79,70,229,.7);
			}
			.tu-save-inline:hover, .tu-actionbar .btn-primary:hover { filter: brightness(1.06); }

			/* Basic info form */
			.tu-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 22px; }
			@media (max-width: 720px) { .tu-form-grid { grid-template-columns: 1fr; } }
			.tu-form-cell.tu-form-full { grid-column: 1 / -1; }
			.tu-form-grid .frappe-control { margin-bottom: 0; }
			.tu-form-grid .control-label { font-size: 12px; color: var(--text-muted); }

			/* Upload cards */
			.tu-uploads { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
			@media (max-width: 900px) { .tu-uploads { grid-template-columns: 1fr; } }
			.tu-upcard { display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--border-color); border-top: 3px solid var(--border-color); border-radius: 12px; padding: 16px; background: var(--card-bg); transition: box-shadow .2s, transform .12s; }
			.tu-upcard:hover { box-shadow: 0 14px 28px -20px rgba(0,0,0,.45); transform: translateY(-2px); }
			.tu-accent-indigo.tu-upcard { border-top-color: var(--tu-indigo); }
			.tu-accent-teal.tu-upcard { border-top-color: var(--tu-teal); }
			.tu-accent-slate.tu-upcard { border-top-color: var(--tu-slate); }
			.tu-upcard-head { display: flex; gap: 10px; align-items: flex-start; }
			.tu-upcard-icon { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 6px 14px -8px rgba(0,0,0,.5); }
			.tu-accent-indigo .tu-upcard-icon { background: var(--tu-indigo); }
			.tu-accent-teal .tu-upcard-icon { background: var(--tu-teal); }
			.tu-accent-slate .tu-upcard-icon { background: var(--tu-slate); }
			.tu-upcard-icon .icon { stroke: #fff; }
			.tu-upcard-title { font-weight: 650; font-size: 13.5px; line-height: 1.3; }
			.tu-upcard-sub { font-size: 12px; color: var(--text-muted); margin-top: 3px; line-height: 1.4; }

			.tu-drop { position: relative; border: 2px dashed var(--border-color); border-radius: 10px; background: var(--control-bg); min-height: 128px; display: flex; align-items: center; justify-content: center; padding: 16px; cursor: pointer; text-align: center; transition: border-color .15s, background .15s; }
			.tu-accent-indigo .tu-drop:hover { border-color: var(--tu-indigo); }
			.tu-accent-teal .tu-drop:hover { border-color: var(--tu-teal); }
			.tu-accent-slate .tu-drop:hover { border-color: var(--tu-slate); }
			.tu-drop:focus { outline: none; box-shadow: 0 0 0 3px rgba(99,102,241,.14); }
			.tu-drop.is-dragover { background: rgba(99,102,241,.08); border-color: var(--tu-indigo); }
			.tu-drop.has-file { border-style: solid; border-color: var(--green-400, #68d391); background: rgba(72,187,120,.05); }
			.tu-drop.has-error { border-style: solid; border-color: var(--red-400, #fc8181); }
			.tu-drop-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; }
			.tu-drop-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--fg-color, rgba(0,0,0,.03)); color: var(--text-muted); }
			.tu-drop-text { font-size: 13px; }
			.tu-drop-text strong { color: var(--tu-indigo); }
			.tu-drop-accept { font-size: 10.5px; letter-spacing: .03em; color: var(--text-muted); text-transform: uppercase; }

			.tu-progress { position: absolute; left: 12px; right: 12px; bottom: 10px; height: 4px; background: var(--border-color); border-radius: 4px; overflow: hidden; }
			.tu-progress-bar { height: 100%; width: 0%; background: var(--tu-indigo); transition: width .2s; }

			.tu-file { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--card-bg); }
			.tu-file-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
			.tu-file-name { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
			.tu-file-remove { border: none; background: transparent; cursor: pointer; color: var(--text-muted); border-radius: 6px; padding: 3px; line-height: 0; }
			.tu-file-remove:hover { color: var(--red-500, #e53e3e); background: var(--fg-color, rgba(0,0,0,.05)); }
			.tu-file-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
			.tu-file-type { font-size: 11px; color: var(--text-muted); font-weight: 600; }

			/* Rules box */
			.tu-rules { margin-top: 16px; display: flex; gap: 12px; padding: 14px 16px; border-radius: 10px; background: var(--alert-bg-info, rgba(99,102,241,.06)); border: 1px solid var(--border-color); }
			.tu-rules-title { display: flex; align-items: center; gap: 6px; font-weight: 650; font-size: 13px; white-space: nowrap; }
			.tu-rules-body { font-size: 12.5px; color: var(--text-color); }
			.tu-rules-note { color: var(--text-muted); margin-top: 4px; line-height: 1.5; }

			/* Action bar */
			.tu-actionbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 14px 18px; }
			.tu-actionbar .btn { border-radius: 9px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
			.tu-actionbar .btn .icon { stroke: currentColor; }
			.tu-actionbar .btn:disabled { opacity: .5; cursor: not-allowed; }
			.tu-actionbar-spacer { flex: 1 1 auto; }

			/* Result card */
			.tu-result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-top: 12px; }
			@media (max-width: 720px) { .tu-result-grid { grid-template-columns: 1fr; } }
			.tu-result-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed var(--border-color); }
			.tu-result-label { font-size: 13px; color: var(--text-muted); }
			.tu-result-value { font-weight: 650; font-size: 14px; }

			/* Badges */
			.tu-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; line-height: 1.4; }
			.tu-badge-gray { background: var(--gray-200, #edeef0); color: var(--gray-700, #495057); }
			.tu-badge-blue { background: #e0ecff; color: #1c4ed8; }
			.tu-badge-orange { background: #ffedd5; color: #c2410c; }
			.tu-badge-yellow { background: #fef3c7; color: #b45309; }
			.tu-badge-green { background: #dcfce7; color: #15803d; }
			.tu-badge-red { background: #fee2e2; color: #b91c1c; }

			.hidden { display: none !important; }
		`;
		$("<style>", { id: "tender-upload-styles", text: css }).appendTo(document.head);
	}
};
