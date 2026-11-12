---
"@langchain/google": patch
---

* Add `gemini-4-hydrogen` model profile.
* Support the `xhigh` (`XHIGH`) thinking level (clamping to `HIGH` on models 
  that do not support `XHIGH` and passing through future thinking levels on level-based models).
