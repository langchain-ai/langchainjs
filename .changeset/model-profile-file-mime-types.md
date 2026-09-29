---
"@langchain/core": patch
"@langchain/openai": patch
---

Add `fileMimeTypes` to `ModelProfile` so models can advertise the MIME types they accept as generic file inputs. OpenAI Responses API models now report the file types `input_file` supports; 
Chat Completions profiles are unchanged.
