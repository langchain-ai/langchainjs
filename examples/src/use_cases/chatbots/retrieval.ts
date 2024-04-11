/* eslint-disable import/first */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-duplicates */

import { ChatOpenAI } from "@langchain/openai";

const chat = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
  temperature: 0.2,
});

import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";

const loader = new CheerioWebBaseLoader(
  "https://docs.smith.langchain.com/user_guide"
);

const rawDocs = await loader.load();

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 0,
});

const allSplits = await textSplitter.splitDocuments(rawDocs);

import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

const vectorstore = await MemoryVectorStore.fromDocuments(
  allSplits,
  new OpenAIEmbeddings()
);

const retriever = vectorstore.asRetriever(4);

const docs = await retriever.invoke("how can langsmith help with testing?");

console.log(docs);

import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

const SYSTEM_TEMPLATE = `Answer the user's questions based on the below context. 
If the context doesn't contain any relevant information to the question, don't make something up and just say "I don't know":

<context>
{context}
</context>
`;

const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM_TEMPLATE],
  new MessagesPlaceholder("messages"),
]);

const documentChain = await createStuffDocumentsChain({
  llm: chat,
  prompt: questionAnsweringPrompt,
});

import { HumanMessage, AIMessage } from "@langchain/core/messages";

console.log(
  await documentChain.invoke({
    messages: [
      new HumanMessage("Can LangSmith help test my LLM applications?"),
    ],
    context: docs,
  })
);

console.log(
  await documentChain.invoke({
    messages: [
      new HumanMessage("Can LangSmith help test my LLM applications?"),
    ],
    context: [],
  })
);

import type { BaseMessage } from "@langchain/core/messages";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";

const parseRetrieverInput = (params: { messages: BaseMessage[] }) => {
  return params.messages[params.messages.length - 1].content;
};

const retrievalChain = RunnablePassthrough.assign({
  context: RunnableSequence.from([parseRetrieverInput, retriever]),
}).assign({
  answer: documentChain,
});

console.log(
  await retrievalChain.invoke({
    messages: [
      new HumanMessage("Can LangSmith help test my LLM applications?"),
    ],
  })
);

console.log(await retriever.invoke("Tell me more!"));

const queryTransformPrompt = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder("messages"),
  [
    "user",
    "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation. Only respond with the query, nothing else.",
  ],
]);

const queryTransformationChain = queryTransformPrompt.pipe(chat);

console.log(
  await queryTransformationChain.invoke({
    messages: [
      new HumanMessage("Can LangSmith help test my LLM applications?"),
      new AIMessage(
        "Yes, LangSmith can help test and evaluate your LLM applications. It allows you to quickly edit examples and add them to datasets to expand the surface area of your evaluation sets or to fine-tune a model for improved quality or reduced costs. Additionally, LangSmith can be used to monitor your application, log all traces, visualize latency and token usage statistics, and troubleshoot specific issues as they arise."
      ),
      new HumanMessage("Tell me more!"),
    ],
  })
);

import { RunnableBranch } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

const queryTransformingRetrieverChain = RunnableBranch.from([
  [
    (params: { messages: BaseMessage[] }) => params.messages.length === 1,
    RunnableSequence.from([parseRetrieverInput, retriever]),
  ],
  queryTransformPrompt
    .pipe(chat)
    .pipe(new StringOutputParser())
    .pipe(retriever),
]).withConfig({ runName: "chat_retriever_chain" });

const conversationalRetrievalChain = RunnablePassthrough.assign({
  context: queryTransformingRetrieverChain,
}).assign({
  answer: documentChain,
});

console.log(
  await conversationalRetrievalChain.invoke({
    messages: [
      new HumanMessage("Can LangSmith help test my LLM applications?"),
    ],
  })
);

console.log(
  await conversationalRetrievalChain.invoke({
    messages: [
      new HumanMessage("Can LangSmith help test my LLM applications?"),
      new AIMessage(
        "Yes, LangSmith can help test and evaluate your LLM applications. It allows you to quickly edit examples and add them to datasets to expand the surface area of your evaluation sets or to fine-tune a model for improved quality or reduced costs. Additionally, LangSmith can be used to monitor your application, log all traces, visualize latency and token usage statistics, and troubleshoot specific issues as they arise."
      ),
      new HumanMessage("Tell me more!"),
    ],
  })
);

const stream = await conversationalRetrievalChain.stream({
  messages: [
    new HumanMessage("Can LangSmith help test my LLM applications?"),
    new AIMessage(
      "Yes, LangSmith can help test and evaluate your LLM applications. It allows you to quickly edit examples and add them to datasets to expand the surface area of your evaluation sets or to fine-tune a model for improved quality or reduced costs. Additionally, LangSmith can be used to monitor your application, log all traces, visualize latency and token usage statistics, and troubleshoot specific issues as they arise."
    ),
    new HumanMessage("Tell me more!"),
  ],
});

for await (const chunk of stream) {
  console.log(chunk);
}
