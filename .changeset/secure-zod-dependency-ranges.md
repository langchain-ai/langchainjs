---
"@langchain/core": patch
"@langchain/classic": patch
"langchain": patch
"@langchain/mcp-adapters": patch
"@langchain/anthropic": patch
"@langchain/ibm": patch
"@langchain/openai": patch
"@langchain/tavily": patch
"@langchain/typesafe": patch
---

Require Zod 4.6.6 or newer for installed dependencies to exclude versions affected by GHSA-mrhx-c7xc-m3w5. Zod v3 schemas remain supported through the bundled `zod/v3` entry point.
