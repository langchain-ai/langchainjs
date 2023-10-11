import { Document } from "langchain/document";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";
import { PromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence } from "langchain/schema/runnable";

export const run = async () => {
  /* Initialize the LLM & set streaming to true */
  const model = new ChatOpenAI({
    streaming: true,
  });
  /* Load in the file we want to do question answering over */
  const text = fs.readFileSync("state_of_the_union.txt", "utf8");
  /* Split the text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = await textSplitter.createDocuments([text]);
  /* Create the vectorstore */
  const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
  const retriever = vectorStore.asRetriever();

  const serializeDocs = (docs: Array<Document>) =>
    docs.map((doc) => doc.pageContent).join("\n\n");

  /**
   * Create a prompt template for generating an answer based on context and
   * a question.
   *
   * Chat history will be an empty string if it's the first question.
   *
   * inputVariables: ["chatHistory", "context", "question"]
   */
  const questionPrompt = PromptTemplate.fromTemplate(
    `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\nCONTEXT: {context}\n\nCHAT HISTORY: {chatHistory}\n\nQUESTION: {question}\n\nHelpful Answer:`
  );

  const chain = RunnableSequence.from([
    {
      question: (input: { question: string; chatHistory?: string }) =>
        input.question,
      chatHistory: (input: { question: string; chatHistory?: string }) =>
        input.chatHistory ?? "",
      context: async (input: { question: string; chatHistory?: string }) => {
        const relevantDocs = await retriever.getRelevantDocuments(
          input.question
        );
        const serialized = serializeDocs(relevantDocs);
        return serialized;
      },
    },
    questionPrompt,
    model,
    new StringOutputParser(),
  ]);

  const questionOne = "What did the president say about Justice Breyer?";

  const stream = await chain.stream({
    question: questionOne,
  });

  let streamedResult = "";
  for await (const chunk of stream) {
    streamedResult += chunk;
    console.log(streamedResult);
  }

  /**
   * The
   * president
   * said
   * that
   * Justice
   * B
   * rey
   * er
   * has
   * dedicated
   * his
   * life
   * to
   * serving
   * the
   * country
   * and
   * thanked
   * him
   * for
   * his
   * service
   * .
   */
};
