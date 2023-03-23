# Chat Vector DB QA Chain

The Chat Vector DB QA chain requires two inputs: a question and the chat history. It first combines the chat history and the question into a standalone question, then looks up relevant documents from the vector database, and then passes those documents and the question to a question answering chain to return a response.

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
const docs = await textSplitter.createDocuments([text]);
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

In this code snippet, the fromLLM method of the ChatVectorDBQAChain class has the following signature:

```typescript
static fromLLM(
  llm: BaseLanguageModel,
  vectorstore: VectorStore,
  options?: {
    questionGeneratorTemplate?: string;
    qaTemplate?: string;
    returnSourceDocuments?: boolean;
    k?: number;
  }
): ChatVectorDBQAChain
```

Here's an explanation of each of the attributes of the options object:

- `questionGeneratorTemplate`: A string that specifies a question generation template. If provided, the ChatVectorDBQAChain will use this template to generate a question from the conversation context, instead of using the question provided in the question parameter. This can be useful if the original question does not contain enough information to retrieve a suitable answer.
- `qaTemplate`: A string that specifies a response template. If provided, the ChatVectorDBQAChain will use this template to format a response before returning the result. This can be useful if you want to customize the way the response is presented to the end user.
- `returnSourceDocuments`: A boolean value that indicates whether the ChatVectorDBQAChain should return the source documents that were used to retrieve the answer. If set to true, the documents will be included in the result returned by the call() method. This can be useful if you want to allow the user to see the sources used to generate the answer. If not set, the default value will be false.
- `k`: An integer that specifies the number of documents to retrieve from the vector store. If not set, the default value will be 4.

In summary, the `questionGeneratorTemplate`, `qaTemplate`, and `returnSourceDocuments` options allow the user to customize the behavior of the `ChatVectorDBQAChain`
