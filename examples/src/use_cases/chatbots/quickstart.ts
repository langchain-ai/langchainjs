/* eslint-disable import/first */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-duplicates */

import { ChatOpenAI } from "@langchain/openai";

const chat = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
  temperature: 0.2,
});

import { HumanMessage } from "@langchain/core/messages";

await chat.invoke([
  new HumanMessage(
    "Translate this sentence from English to French: I love programming."
  ),
]);

await chat.invoke([new HumanMessage("What did you just say?")]);

import { AIMessage } from "@langchain/core/messages";

await chat.invoke([
  new HumanMessage(
    "Translate this sentence from English to French: I love programming."
  ),
  new AIMessage("J'adore la programmation."),
  new HumanMessage("What did you just say?"),
]);

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. Answer all questions to the best of your ability.",
  ],
  new MessagesPlaceholder("messages"),
]);

const chain = prompt.pipe(chat);

await chain.invoke({
  messages: [
    new HumanMessage(
      "Translate this sentence from English to French: I love programming."
    ),
    new AIMessage("J'adore la programmation."),
    new HumanMessage("What did you just say?"),
  ],
});

import { ChatMessageHistory } from "langchain/stores/message/in_memory";

const demoEphemeralChatMessageHistory = new ChatMessageHistory();

await demoEphemeralChatMessageHistory.addMessage(new HumanMessage("hi!"));

await demoEphemeralChatMessageHistory.addMessage(new AIMessage("whats up?"));

console.log(await demoEphemeralChatMessageHistory.getMessages());

await demoEphemeralChatMessageHistory.addMessage(
  new HumanMessage(
    "Translate this sentence from English to French: I love programming."
  )
);

const responseMessage = await chain.invoke({
  messages: await demoEphemeralChatMessageHistory.getMessages(),
});

await demoEphemeralChatMessageHistory.addMessage(responseMessage);

await demoEphemeralChatMessageHistory.addMessage(
  new HumanMessage("What did you just say?")
);

const responseMessage2 = await chain.invoke({
  messages: await demoEphemeralChatMessageHistory.getMessages(),
});

console.log(responseMessage2);

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

const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Answer the user's questions based on the below context:\n\n{context}",
  ],
  new MessagesPlaceholder("messages"),
]);

const documentChain = await createStuffDocumentsChain({
  llm: chat,
  prompt: questionAnsweringPrompt,
});

const demoEphemeralChatMessageHistory2 = new ChatMessageHistory();

await demoEphemeralChatMessageHistory2.addMessage(
  new HumanMessage("how can langsmith help with testing?")
);

console.log(
  await documentChain.invoke({
    messages: await demoEphemeralChatMessageHistory2.getMessages(),
    context: docs,
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

const response3 = await retrievalChain.invoke({
  messages: await demoEphemeralChatMessageHistory2.getMessages(),
});

console.log(response3);

await demoEphemeralChatMessageHistory2.addMessage(
  new AIMessage(response3.answer)
);

await demoEphemeralChatMessageHistory2.addMessage(
  new HumanMessage("tell me more about that!")
);

console.log(
  await retrievalChain.invoke({
    messages: await demoEphemeralChatMessageHistory2.getMessages(),
  })
);

const retrievalChainWithOnlyAnswer = RunnablePassthrough.assign({
  context: RunnableSequence.from([parseRetrieverInput, retriever]),
}).pipe(documentChain);

console.log(
  await retrievalChainWithOnlyAnswer.invoke({
    messages: await demoEphemeralChatMessageHistory2.getMessages(),
  })
);

console.log(await retriever.invoke("how can langsmith help with testing?"));

console.log(await retriever.invoke("tell me more about that!"));

import { RunnableBranch } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

const queryTransformPrompt = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder("messages"),
  [
    "user",
    "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation. Only respond with the query, nothing else.",
  ],
]);

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

const demoEphemeralChatMessageHistory3 = new ChatMessageHistory();

await demoEphemeralChatMessageHistory3.addMessage(
  new HumanMessage("how can langsmith help with testing?")
);

const response4 = await conversationalRetrievalChain.invoke({
  messages: await demoEphemeralChatMessageHistory3.getMessages(),
});

await demoEphemeralChatMessageHistory3.addMessage(
  new AIMessage(response4.answer)
);

console.log(response4);

await demoEphemeralChatMessageHistory3.addMessage(
  new HumanMessage("tell me more about that!")
);

console.log(
  await conversationalRetrievalChain.invoke({
    messages: await demoEphemeralChatMessageHistory3.getMessages(),
  })
);
