---
"@langchain/core": patch
---

fix(core): only treat arrays of content blocks as ToolMessage content

Fix tool outputs that are arrays of plain objects being forwarded as malformed message content. An array is now only treated as message content blocks when every element is an object with a `type`; otherwise it is JSON-stringified.
