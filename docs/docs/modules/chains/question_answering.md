# Question Answering Chain

A question answering chain takes as input documents and a question and then uses the language model to answer that question given the relevant documents.

```typescript
import { OpenAI } from "langchain/llms";
import { loadQAChain } from "langchain/chains";
import { Document } from "langchain/document";

const model = new OpenAI({});
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

const model = new OpenAI({});
const chain = loadQAChain(llm, { type: "map_reduce" });
/* Optionally you can limit the concurrency of the map-reduce chain to help
 * with rate limiting, eg. the following would limit to 10 concurrent requests
 *
 * chain.llmChain.concurrency = 10;
 */
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
