---
"langchain": patch
---

Fix `piiMiddleware` hanging when a custom `detector` is a `RegExp` without the `g` flag. RegExp detectors now scan a fresh global copy on every call, so they find every match, terminate, and ignore a stale `lastIndex` left on the caller's pattern.
