---
"@langchain/anthropic": patch
---

fix(anthropic): do not send files with unknown MIME type as application/pdf documents

Files whose MIME type is empty/unknown (e.g. `.pem`, `.keystore`) were encoded as `document.source.base64` blocks with `media_type: "application/pdf"`, which the Anthropic API rejects with a 400. Empty MIME types are now only treated as PDF when the data actually has PDF magic bytes; other unknown binaries raise a clear error instead.
