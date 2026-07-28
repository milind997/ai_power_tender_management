# Copyright (c) 2026, milind and Contributors
# See license.txt

from frappe.tests.utils import FrappeTestCase

from ai_power_tender_management.api import tender_workspace
from ai_power_tender_management.utils import ai_service


class TestTenderWorkspace(FrappeTestCase):
	def test_knowledge_chunks_keep_page_and_section_metadata(self):
		source = {
			"row_name": "ROW-1",
			"source_document": "Tender.pdf",
			"document_type": "Tender Document",
			"file_format": "pdf",
		}
		chunks = tender_workspace._chunk_source_text(
			source,
			"[Page 7]\nجدول الكميات\nFLOW METER | quantity | unit price",
		)

		self.assertEqual(chunks[0]["page_start"], 7)
		self.assertEqual(chunks[0]["section"], "BOQ")
		self.assertEqual(chunks[0]["source_document"], "Tender.pdf")

	def test_compact_text_for_terms_avoids_full_document_prompt(self):
		text = "\n\n".join([
			"intro " * 500,
			"closing date 2026-08-20 bid bond SAR 100000 client NWC",
			"scope " * 500,
		])

		compact = tender_workspace._compact_text_for_terms(
			text,
			("closing", "bond", "client"),
			max_chars=350,
		)

		self.assertIn("closing date", compact)
		self.assertLessEqual(len(compact), 350)

	def test_task_model_routing_prefers_configured_task_model(self):
		class Settings:
			model = "default-model"
			tender_extraction_model = "small-extractor"
			tender_arabic_proposal_model = "proposal-writer"

		self.assertEqual(ai_service.get_task_model(Settings(), "extraction"), "small-extractor")
		self.assertEqual(ai_service.get_task_model(Settings(), "arabic_proposal"), "proposal-writer")
		self.assertEqual(ai_service.get_task_model(Settings(), "unknown"), "default-model")

	def test_failure_result_includes_error_log_url(self):
		original = tender_workspace._log_tender_error
		try:
			tender_workspace._log_tender_error = lambda *args, **kwargs: "ERR-0001"
			result = tender_workspace._failure_result(
				"AI Failed",
				"Could not parse the reply.",
				"Tender Test",
				"TW-TEST",
				items_count=0,
			)
		finally:
			tender_workspace._log_tender_error = original

		self.assertEqual(result["status"], "AI Failed")
		self.assertEqual(result["items_count"], 0)
		self.assertEqual(result["error_log"], "ERR-0001")
		self.assertEqual(result["error_log_url"], "/app/error-log/ERR-0001")

	def test_run_pipeline_publishes_error_log_for_domain_failure(self):
		events = []
		original_publish = tender_workspace._publish
		try:
			tender_workspace._publish = lambda *args, **kwargs: events.append({"args": args, "kwargs": kwargs})

			def worker(_name):
				return {
					"status": "No Items Found",
					"message": "No BOQ items found.",
					"error_log": "ERR-BOQ",
				}

			tender_workspace._run_pipeline("TW-TEST", "boq", "Starting", worker)
		finally:
			tender_workspace._publish = original_publish

		self.assertEqual(events[-1]["kwargs"]["state"], "failed")
		self.assertEqual(events[-1]["kwargs"]["error_log"], "ERR-BOQ")

	def test_partial_pipeline_result_is_warning_with_error_log(self):
		events = []
		original_publish = tender_workspace._publish
		try:
			tender_workspace._publish = lambda *args, **kwargs: events.append({"args": args, "kwargs": kwargs})

			def worker(_name):
				return {
					"status": "Partial",
					"message": "Some proposal sections used placeholders.",
					"error_log": "ERR-PARTIAL",
				}

			tender_workspace._run_pipeline("TW-TEST", "proposal", "Starting", worker)
		finally:
			tender_workspace._publish = original_publish

		self.assertEqual(events[-1]["kwargs"]["state"], "warning")
		self.assertEqual(events[-1]["kwargs"]["error_log"], "ERR-PARTIAL")

	def test_log_sanitizer_redacts_and_truncates_secrets(self):
		text = tender_workspace._sanitize_log_text(
			"api_key=sk-testSECRET1234567890 password=hunter2 " + ("x" * 80),
			max_chars=60,
		)

		self.assertIn("api_key=[redacted]", text)
		self.assertIn("password=[redacted]", text)
		self.assertNotIn("sk-testSECRET", text)
		self.assertTrue(text.endswith("...[truncated]"))
