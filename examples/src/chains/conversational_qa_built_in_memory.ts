import { Document } from "langchain/document";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { LLMChain } from "langchain/chains";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BufferMemory } from "langchain/memory";
import * as fs from "fs";
import { PromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";
import { BaseMessage } from "langchain/schema";
import { formatDocumentsAsString } from "langchain/util/document";

const text = fs.readFileSync("state_of_the_union.txt", "utf8");

const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);

const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
const retriever = vectorStore.asRetriever();

const memory = new BufferMemory({
  memoryKey: "chatHistory",
  inputKey: "question", // The key for the input to the chain
  outputKey: "text", // The key for the final conversational output of the chain
  returnMessages: true, // If using with a chat model (e.g. gpt-3.5 or gpt-4)
});

const serializeChatHistory = (chatHistory: Array<BaseMessage>): string =>
  chatHistory
    .map((chatMessage) => {
      if (chatMessage._getType() === "human") {
        return `Human: ${chatMessage.content}`;
      } else if (chatMessage._getType() === "ai") {
        return `Assistant: ${chatMessage.content}`;
      } else {
        return `${chatMessage.content}`;
      }
    })
    .join("\n");

/**
 * Create two prompt templates, one for answering questions, and one for
 * generating questions.
 */
const questionPrompt = PromptTemplate.fromTemplate(
  `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------
CONTEXT: {context}
----------
CHAT HISTORY: {chatHistory}
----------
QUESTION: {question}
----------
Helpful Answer:`
);
const questionGeneratorTemplate = PromptTemplate.fromTemplate(
  `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.
----------
CHAT HISTORY: {chatHistory}
----------
FOLLOWUP QUESTION: {question}
----------
Standalone question:`
);

// Initialize fast and slow LLMs, along with chains for each
const fasterModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
});
const fasterChain = new LLMChain({
  llm: fasterModel,
  prompt: questionGeneratorTemplate,
});

const slowerModel = new ChatOpenAI({
  modelName: "gpt-4",
});
const slowerChain = new LLMChain({
  llm: slowerModel,
  prompt: questionPrompt,
});

const performQuestionAnswering = async (input: {
  question: string;
  chatHistory: Array<BaseMessage> | null;
  context: Array<Document>;
}): Promise<{ result: string; sourceDocuments: Array<Document> }> => {
  let newQuestion = input.question;
  // Serialize context and chat history into strings
  const serializedDocs = formatDocumentsAsString(input.context);
  const chatHistoryString = input.chatHistory
    ? serializeChatHistory(input.chatHistory)
    : null;

  if (chatHistoryString) {
    // Call the faster chain to generate a new question
    const { text } = await fasterChain.invoke({
      chatHistory: chatHistoryString,
      context: serializedDocs,
      question: input.question,
    });

    newQuestion = text;
  }

  const response = await slowerChain.invoke({
    chatHistory: chatHistoryString ?? "",
    context: serializedDocs,
    question: newQuestion,
  });

  // Save the chat history to memory
  await memory.saveContext(
    {
      question: input.question,
    },
    {
      text: response.text,
    }
  );

  return {
    result: response.text,
    sourceDocuments: input.context,
  };
};

const chain = RunnableSequence.from([
  {
    // Pipe the question through unchanged
    question: (input: { question: string }) => input.question,
    // Fetch the chat history, and return the history or null if not present
    chatHistory: async () => {
      const savedMemory = await memory.loadMemoryVariables({});
      const hasHistory = savedMemory.chatHistory.length > 0;
      return hasHistory ? savedMemory.chatHistory : null;
    },
    // Fetch relevant context based on the question
    context: async (input: { question: string }) =>
      retriever.getRelevantDocuments(input.question),
  },
  performQuestionAnswering,
]);

const resultOne = await chain.invoke({
  question: "What did the president say about Justice Breyer?",
});
console.log({ resultOne });
/**
 * {
 *   resultOne: {
 *     result: "The president thanked Justice Breyer for his service and described him as an Army veteran, Constitutional scholar, and retiring Justice of the United States Supreme Court.",
 *     sourceDocuments: [...]
 *   }
 * }
 */

const resultTwo = await chain.invoke({
  question: "Was he nice?",
});
console.log({ resultTwo });
/**
 * {
 *   resultTwo: {
 *     result: "Yes, the president's description of Justice Breyer was positive."
 *     sourceDocuments: [...]
 *   }
 * }
 */
