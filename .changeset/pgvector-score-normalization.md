---
"@langchain/community": minor
---

Add score normalization feature to PGVectorStore allowing users to choose between returning raw distances or normalized similarity scores. This makes PGVectorStore consistent with other vector stores in the LangChain ecosystem where higher scores indicate greater similarity. Maintains full backward compatibility by defaulting to distance mode.
