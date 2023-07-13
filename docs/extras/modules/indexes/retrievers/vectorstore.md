---
hide_table_of_contents: true
---

# Vector Store

Once you've created a [Vector Store](../vector_stores/), the way to use it as a Retriever is very simple:

```typescript
vectorStore = ...
retriever = vectorStore.asRetriever()
```
