# Question Answering Chain

A question answering chain takes as input documents and a question and then uses the language model to answer that question given the relevant documents.

```typescript
import { OpenAI } from "langchain/llms";
import { loadQAChain } from "langchain/chains";
import { Document } from "langchain/document";

const model = new OpenAI({});
const chain = loadQAChain(model);
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
