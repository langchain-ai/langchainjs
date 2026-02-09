---
"@langchain/classic": patch
"@langchain/model-profiles": patch
"@langchain/turbopuffer": patch
---

fix: resolve flaky tests and configuration issues

- @langchain/turbopuffer: Allow tests to pass when no test files are found (vitest --passWithNoTests)
- @langchain/model-profiles: Fix broken import path in generator test
- @langchain/classic: Fix AutoGPTPrompt test to be locale-independent by forcing en-US locale
