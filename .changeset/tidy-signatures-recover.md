---
"@langchain/google-common": patch
---

fix(google-common): recover Gemini 3.x thought signatures dropped by streamed chunk-merge misalignment

When a tool-calling turn is streamed, chunk merging can leave the `signatures` array longer than the re-serialized parts (e.g. `["sig", ""]` for a single `functionCall` part). The exact-length guard then dropped every signature, so the replayed `functionCall` carried no `thoughtSignature` and Gemini 3.x rejected the next turn with `400 INVALID_ARGUMENT`. Falls back to mapping the non-empty signatures onto the `functionCall` parts in order when lengths do not match. Fixes #9624.
