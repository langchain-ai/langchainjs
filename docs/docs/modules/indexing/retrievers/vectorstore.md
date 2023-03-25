# VectorStore

The main supported type of Retriever is one backed by a Vector Store.
Once you've created a Vector Store, the way to use it as a Retriever is very simple:

```typescript
vectorStore = ...
retriever = vectorStore.asRetriever()
```
