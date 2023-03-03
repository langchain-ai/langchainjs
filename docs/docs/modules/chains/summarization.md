# Summarization Chain

A summarization chain can be used to summarize multiple documents. There are a few different ways to use such a chain. You can either take as input multiple smaller documents (after they have been split into chunks) and operate over those, or you can use the `AnalyzeDocumentChain` which takes a single piece of text as input and operates over that.

In the first usage example, we will utilize the `AnalyzeDocumentChain`, which takes a single piece of text as input.

```typescript
import { OpenAI } from "langchain/llms";
import { loadSummarizationChain } from "langchain/chains";
import { AnalyzeDocumentChain } from "langchain/chains";
import * as fs from "fs";

const text = fs.readFileSync("state_of_the_union.txt", "utf8");
const model = new OpenAI({ temperature: 0 });
/** Load the summarization chain. */
const combineDocsChain = loadSummarizationChain(model);
/** Pass this into the AnalyzeDocumentChain. */
const chain = new AnalyzeDocumentChain({
  combineDocumentsChain: combineDocsChain,
});
const res = await chain.call({
  input_document: text,
});
console.log({ res });
```

The next usage examples takes as inputs multiple examples, but it assumes that the documents have already been split into smaller chunks.

```typescript
import { OpenAI } from "langchain/llms";
import { loadSummarizationChain } from "langchain/chains";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";

const text = fs.readFileSync("state_of_the_union.txt", "utf8");
const model = new OpenAI({ temperature: 0 });
/* Split the text into chunks. */
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);
/** Call the summarization chain. */
const chain = loadSummarizationChain(model);
const res = await chain.call({
  input_documents: docs,
});
console.log(res);
```

By default, the QA chain will do a map-reduce technique, where it summarizes each chunk individually and then summarizes the summaries.
This is good because it avoids any context window lengths, but is bad because it takes more calls to the language model.
If you have a smaller set of documents and want to just pass them into the same prompt, you can use the `stuff` method.

```typescript
import { OpenAI } from "langchain/llms";
import { loadQAChain } from "langchain/chains";
import { Document } from "langchain/document";

const model = new OpenAI({});
const chain = loadQAChain(llm, { type: "stuff" });
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
