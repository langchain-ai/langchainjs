# Question Answering Chain

A question answering chain takes as input documents and a question and then uses the language model to answer that question given the relevant documents.

```typescript
import { OpenAI } from "langchain/llms";
import { loadQAChain } from "langchain/chains";
import { Document } from "langchain/document";

const llm = new OpenAI({});
const chain = loadQAChain(llm);
const docs = [
  new Document({ pageContent: "harrison went to harvard" }),
  new Document({ pageContent: "ankush went to princeton" }),
];
const res = await chain.call({
  input_documents: docs,
  question: "Where did harrison go to college",
});
console.log({ res });
```

By default, the QA chain will try to stuff all the documents into the context window.
If you have a lot of documents, you may want to try using the map-reduce method.

```typescript
import { OpenAI } from "langchain/llms";
import { loadQAChain } from "langchain/chains";
import { Document } from "langchain/document";

// Optionally limit the nr of concurrent requests to the language model,
// if you have a lot of documents, to avoid rate limiting.
const llm = new OpenAI({ concurrency: 10 });
const chain = loadQAChain(llm, { type: "map_reduce" });
const docs = [
  new Document({ pageContent: "harrison went to harvard" }),
  new Document({ pageContent: "ankush went to princeton" }),
];
const res = await chain.call({
  input_documents: docs,
  question: "Where did harrison go to college",
});
console.log({ res });
```
