# Copyright (c) 2026, milind and contributors
# For license information, please see license.txt
"""
Thin LLM access layer for the Tender workflow.

The LLM provider/model/key/limits are read from the **AI Settings** Single
DocType (provided by the smart_journal app) — nothing is hardcoded here. This
keeps the tender AI features configurable from one place and consistent with
the rest of the site.

Usage:
    from ai_power_tender_management.utils import ai_service
    if ai_service.is_enabled():
        text = ai_service.complete(prompt, system="...")

All calls fail soft: on any misconfiguration or provider error they log and
return None so callers can fall back to placeholder behaviour.
"""

import json
import time

import frappe

SETTINGS_DOCTYPE = "AI Settings"

# Conservative input-token budget per minute (org limit is ~10k). Used to pace
# chunked requests so a large document does not trip the rate limit.
RATE_LIMIT_TPM = 8000


def estimate_tokens(text: str) -> int:
	"""Rough token estimate (~4 chars/token)."""
	return max(1, len(text or "") // 4)


def throttle(tokens: int):
	"""Sleep enough to keep average input usage under RATE_LIMIT_TPM."""
	secs = min(60.0, 60.0 * float(tokens) / RATE_LIMIT_TPM)
	if secs > 0:
		time.sleep(secs)


def get_settings():
	"""Return the AI Settings Single doc, or None if the DocType is absent."""
	if not frappe.db.exists("DocType", SETTINGS_DOCTYPE):
		return None
	return frappe.get_single(SETTINGS_DOCTYPE)


def _api_key(settings):
	try:
		return settings.get_password("api_key", raise_exception=False)
	except Exception:
		return None


def is_enabled() -> bool:
	"""True when AI Settings is enabled and an API key is configured."""
	settings = get_settings()
	if not settings or not getattr(settings, "enabled", 0):
		return False
	return bool(_api_key(settings))


def get_llm_config() -> dict:
	"""Read the current LLM configuration from AI Settings (key redacted)."""
	settings = get_settings()
	if not settings:
		return {"enabled": False, "configured": False}

	model = settings.get_default_model() if hasattr(settings, "get_default_model") else settings.model
	return {
		"enabled": bool(getattr(settings, "enabled", 0)),
		"provider": (settings.provider or "").strip(),
		"model": model,
		"base_url": settings.base_url or None,
		"max_tokens": int(settings.max_tokens or 2000),
		"timeout": int(settings.timeout or 120),
		"configured": bool(_api_key(settings)),
	}


def complete(prompt: str, system: str | None = None, max_tokens: int | None = None) -> str | None:
	"""
	Send a single prompt to the configured LLM and return the text response.

	Returns None when AI is disabled/unconfigured or the provider call fails.
	"""
	if not is_enabled():
		return None

	settings = get_settings()
	provider = (settings.provider or "").strip().lower()
	api_key = _api_key(settings)
	model = settings.get_default_model() if hasattr(settings, "get_default_model") else settings.model
	max_tokens = int(max_tokens or settings.max_tokens or 2000)
	timeout = int(settings.timeout or 120)
	base_url = settings.base_url or None

	try:
		if provider == "anthropic":
			import anthropic

			kwargs = {"api_key": api_key, "timeout": timeout, "max_retries": 4}
			if base_url:
				kwargs["base_url"] = base_url
			client = anthropic.Anthropic(**kwargs)
			resp = client.messages.create(
				model=model,
				max_tokens=max_tokens,
				system=system or "",
				messages=[{"role": "user", "content": prompt}],
			)
			return "".join(
				getattr(b, "text", "") for b in resp.content if getattr(b, "type", None) == "text"
			).strip()

		# OpenAI / OpenAI-compatible gateways.
		from openai import OpenAI

		kwargs = {"api_key": api_key, "timeout": timeout}
		if base_url:
			kwargs["base_url"] = base_url
		client = OpenAI(**kwargs)
		messages = []
		if system:
			messages.append({"role": "system", "content": system})
		messages.append({"role": "user", "content": prompt})
		resp = client.chat.completions.create(model=model, max_tokens=max_tokens, messages=messages)
		return (resp.choices[0].message.content or "").strip()

	except Exception:
		frappe.log_error(title="Tender AI: LLM completion failed", message=frappe.get_traceback())
		return None


def complete_json(prompt: str, system: str | None = None, max_tokens: int | None = None):
	"""Call the LLM and parse a JSON object/array from the response."""
	raw = complete(prompt, system=system, max_tokens=max_tokens)
	if not raw:
		return None
	return _extract_json(raw)


def supports_pdf_vision() -> bool:
	"""True when the configured provider can read a PDF natively (Anthropic)."""
	if not is_enabled():
		return False
	settings = get_settings()
	return (settings.provider or "").strip().lower() == "anthropic"


def complete_pdf(file_url: str, prompt: str, system: str | None = None, max_tokens: int | None = None) -> str | None:
	"""
	Send a PDF file *natively* to the model (vision) together with a prompt.

	This is the path for scanned / image-only PDFs that have no extractable
	text layer. Currently implemented for Anthropic (native PDF documents).
	Returns None when unavailable or on error.
	"""
	if not supports_pdf_vision():
		return None

	# Resolve the file to an absolute path (reuse the parser's resolver).
	from ai_power_tender_management.utils import document_parser

	path = document_parser._resolve_file_path(file_url)
	if not path:
		frappe.log_error(title="Tender AI: PDF not found for vision", message=file_url)
		return None

	settings = get_settings()
	api_key = _api_key(settings)
	model = settings.get_default_model() if hasattr(settings, "get_default_model") else settings.model
	max_tokens = int(max_tokens or settings.max_tokens or 2000)
	timeout = int(settings.timeout or 120)
	base_url = settings.base_url or None

	try:
		import base64

		with open(path, "rb") as f:
			pdf_b64 = base64.standard_b64encode(f.read()).decode("utf-8")

		import anthropic

		kwargs = {"api_key": api_key, "timeout": timeout, "max_retries": 4}
		if base_url:
			kwargs["base_url"] = base_url
		client = anthropic.Anthropic(**kwargs)
		resp = client.messages.create(
			model=model,
			max_tokens=max_tokens,
			system=system or "",
			messages=[{
				"role": "user",
				"content": [
					{
						"type": "document",
						"source": {"type": "base64", "media_type": "application/pdf", "data": pdf_b64},
					},
					{"type": "text", "text": prompt},
				],
			}],
		)
		return "".join(
			getattr(b, "text", "") for b in resp.content if getattr(b, "type", None) == "text"
		).strip()
	except Exception as e:
		# Give rate-limit failures a distinct, actionable title in the Error Log.
		is_rate_limit = e.__class__.__name__ == "RateLimitError" or "rate_limit" in str(e).lower()
		title = (
			"Tender AI: PDF too large for AI rate limit"
			if is_rate_limit
			else "Tender AI: PDF vision completion failed"
		)
		frappe.log_error(title=title, message=frappe.get_traceback())
		return None


def complete_pdf_json(file_url: str, prompt: str, system: str | None = None, max_tokens: int | None = None):
	"""Send a PDF to the model and parse a JSON object/array from the response."""
	raw = complete_pdf(file_url, prompt, system=system, max_tokens=max_tokens)
	if not raw:
		return None
	return _extract_json(raw)


def _extract_json(raw: str):
	"""Best-effort JSON parse; tolerates code fences and surrounding prose."""
	text = raw.strip()
	if text.startswith("```"):
		text = text.strip("`")
		if text[:4].lower() == "json":
			text = text[4:]
		text = text.strip()

	try:
		return json.loads(text)
	except Exception:
		pass

	# Fall back to slicing out the first JSON object/array.
	candidates = [i for i in (text.find("{"), text.find("[")) if i != -1]
	if not candidates:
		return None
	start = min(candidates)
	end = max(text.rfind("}"), text.rfind("]"))
	if end <= start:
		return None
	try:
		return json.loads(text[start : end + 1])
	except Exception:
		return None
