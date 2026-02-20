---
"@langchain/openrouter": patch
---

feat(openrouter): default OpenRouter attribution headers

`ChatOpenRouter` now sends `HTTP-Referer` and `X-Title` headers by default for OpenRouter app attribution. `siteUrl` defaults to `"https://docs.langchain.com/oss"` and `siteName` defaults to `"langchain"`. Users can still override both values.
