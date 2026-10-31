---
"@langchain/anthropic": patch
---

Fix the legacy `file` content-block converter emitting invalid document requests. A `file` block carrying base64 data with a non-PDF MIME type was passed straight through as the document `media_type`, which the Anthropic API rejects with `document.source.base64.media_type: Input should be 'application/pdf'`. `_convertMessagesToAnthropicPayload` now mirrors the standard-content converter (`utils/standard.ts`): PDF (and empty) MIME types map to a base64 PDF document, `text/plain` maps to a text document source, and any other type throws a clear error instead of sending a request that always returns a 400.
