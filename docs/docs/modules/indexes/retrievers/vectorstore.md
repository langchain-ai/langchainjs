# VectorStore

The main supported type of Retriever is one backed by a VectorStore.
Once you've created a vectorstore, the way to use it as a retriever is very simple:

```typescript
vectorStore = ....
retriever = vectorStore.asRetriever()
```
