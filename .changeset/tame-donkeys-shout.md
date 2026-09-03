---
"@langchain/openai": patch
"@langchain/core": patch
---

fix(openai): keep concurrent reasoning items separate when streaming

A response can emit more than one reasoning item (e.g. a multi-step tool-calling turn on GPT-5.6). These previously shared one `additional_kwargs.reasoning` object, so concurrent items collided during chunk merging and produced a corrupted `encrypted_content` payload that the Responses API rejected on replay. `additional_kwargs.reasoning` is now an array, one entry per item, keyed by `output_index`.
