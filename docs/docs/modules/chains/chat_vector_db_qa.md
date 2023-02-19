# Chat Vector DB QA Chain

A Chat Vector DB QA chain takes as input a question and chat history. It first combines the chat history and the question into a standalone question, then looks up relevant documents from the vector database, and then passes those documents and the question to a question answering chain to return a response.

To create one, you will need a vectorstore, which can be created from embeddings.

Below is an end-to-end example of doing question answering over a recent state of the union address.

```typescript
import { OpenAI } from "langchain/llms";
import { ChatVectorDBQAChain } from "langchain/chains";
import { HNSWLib } from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";

/* Initialize the LLM to use to answer the question */
const model = new OpenAI({});
/* Load in the file we want to do question answering over */
const text = fs.readFileSync("state_of_the_union.txt", "utf8");
/* Split the text into chunks */
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = textSplitter.createDocuments([text]);
/* Create the vectorstore */
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
/* Create the chain */
const chain = ChatVectorDBQAChain.fromLLM(model, vectorStore);
/* Ask it a question */
const question = "What did the president say about Justice Breyer?";
const res = await chain.call({ question: question, chat_history: [] });
console.log(res);
/* Ask it a follow up question */
const chatHistory = question + res["text"];
const followUpRes = await chain.call({
  question: "Was that nice?",
  chat_history: chatHistory,
});
console.log(followUpRes);
```
