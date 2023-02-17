# Vectorstores

A vectorstore is a particular type of database optimized for storing documents, embeddings, and then allowing for fetching of the most relevant documents for a particular query.

```typescript
import { HNSWLib } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";

const vectorStore = await HNSWLib.fromTexts(
["Hello world", "Bye bye", "hello nice world"],
[{ id: 2 }, { id: 1 }, { id: 3 }],
new OpenAIEmbeddings()
);

const resultOne = await vectorStore.similaritySearch("hello world", 1);
```
