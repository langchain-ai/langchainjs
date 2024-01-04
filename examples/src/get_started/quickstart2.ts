/* eslint-disable import/first */
/* eslint-disable import/no-duplicates */
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

const chatModel = new ChatOpenAI({});

const embeddings = new OpenAIEmbeddings({});

const loader = new CheerioWebBaseLoader(
  "https://docs.smith.langchain.com/overview"
);

const docs = await loader.load();

console.log(docs.length);
console.log(docs[0].pageContent.length);

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const splitter = new RecursiveCharacterTextSplitter();

const splitDocs = await splitter.splitDocuments(docs);

console.log(splitDocs.length);
console.log(splitDocs[0].pageContent.length);

import { MemoryVectorStore } from "langchain/vectorstores/memory";

const vectorstore = await MemoryVectorStore.fromDocuments(
  splitDocs,
  embeddings
);

import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt =
  ChatPromptTemplate.fromTemplate(`Answer the following question based only on the provided context:

<context>
{context}
</context>

Question: {input}`);

const documentChain = await createStuffDocumentsChain({
  llm: chatModel,
  prompt,
});

import { Document } from "@langchain/core/documents";

console.log(
  await documentChain.invoke({
    input: "what is LangSmith?",
    context: [
      new Document({
        pageContent:
          "LangSmith is a platform for building production-grade LLM applications.",
      }),
    ],
  })
);

import { createRetrievalChain } from "langchain/chains/retrieval";

const retriever = vectorstore.asRetriever();

const retrievalChain = await createRetrievalChain({
  combineDocsChain: documentChain,
  retriever,
});

console.log(
  await retrievalChain.invoke({
    input: "what is LangSmith?",
  })
);

import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { MessagesPlaceholder } from "@langchain/core/prompts";

const historyAwarePrompt = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder("chat_history"),
  ["user", "{input}"],
  [
    "user",
    "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation",
  ],
]);

const historyAwareRetrieverChain = await createHistoryAwareRetriever({
  llm: chatModel,
  retriever,
  rephrasePrompt: historyAwarePrompt,
});

import { HumanMessage, AIMessage } from "@langchain/core/messages";

const chatHistory = [
  new HumanMessage("Can LangSmith help test my LLM applications?"),
  new AIMessage("Yes!"),
];

console.log(
  await historyAwareRetrieverChain.invoke({
    chat_history: chatHistory,
    input: "Tell me how!",
  })
);

const historyAwareRetrievalPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Answer the user's questions based on the below context:\n\n{context}",
  ],
  new MessagesPlaceholder("chat_history"),
  ["user", "{input}"],
]);

const historyAwareCombineDocsChain = await createStuffDocumentsChain({
  llm: chatModel,
  prompt: historyAwareRetrievalPrompt,
});

const conversationalRetrievalChain = await createRetrievalChain({
  retriever: historyAwareRetrieverChain,
  combineDocsChain: historyAwareCombineDocsChain,
});

const result2 = await conversationalRetrievalChain.invoke({
  chat_history: [
    new HumanMessage("Can LangSmith help test my LLM applications?"),
    new AIMessage("Yes!"),
  ],
  input: "tell me how",
});

console.log(result2.answer);
