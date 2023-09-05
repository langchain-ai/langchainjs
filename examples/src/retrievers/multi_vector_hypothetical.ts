import * as uuid from "uuid";

import { ChatOpenAI } from "langchain/chat_models/openai";
import { PromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence } from "langchain/schema/runnable";

import { MultiVectorRetriever } from "langchain/retrievers/multi_vector";
import { FaissStore } from "langchain/vectorstores/faiss";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { InMemoryStore } from "langchain/storage/in_memory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { Document } from "langchain/document";
import { JsonKeyOutputFunctionsParser } from "langchain/output_parsers";

const textLoader = new TextLoader("../examples/state_of_the_union.txt");
const parentDocuments = await textLoader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 10000,
  chunkOverlap: 20,
});

const docs = await splitter.splitDocuments(parentDocuments);

const functionsSchema = [
  {
    name: "hypothetical_questions",
    description: "Generate hypothetical questions",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: ["questions"],
    },
  },
];

const functionCallingModel = new ChatOpenAI({
  maxRetries: 0,
  modelName: "gpt-4",
}).bind({
  functions: functionsSchema,
  function_call: { name: "hypothetical_questions" },
});

const chain = RunnableSequence.from([
  { content: (doc: Document) => doc.pageContent },
  PromptTemplate.fromTemplate(
    `Generate a list of 3 hypothetical questions that the below document could be used to answer:\n\n{content}`
  ),
  functionCallingModel,
  new JsonKeyOutputFunctionsParser<string[]>({ attrName: "questions" }),
]);

const hypotheticalQuestions = await chain.batch(
  docs,
  {},
  {
    maxConcurrency: 5,
  }
);

const idKey = "doc_id";
const docIds = docs.map((_) => uuid.v4());
const hypotheticalQuestionDocs = hypotheticalQuestions
  .map((questionArray, i) => {
    const questionDocuments = questionArray.map((question) => {
      const questionDocument = new Document({
        pageContent: question,
        metadata: {
          [idKey]: docIds[i],
        },
      });
      return questionDocument;
    });
    return questionDocuments;
  })
  .flat();

const keyValuePairs: [string, Document][] = docs.map((originalDoc, i) => [
  docIds[i],
  originalDoc,
]);

// The docstore to use to store the original chunks
const docstore = new InMemoryStore();
await docstore.mset(keyValuePairs);

// The vectorstore to use to index the child chunks
const vectorstore = await FaissStore.fromDocuments(
  hypotheticalQuestionDocs,
  new OpenAIEmbeddings()
);

const retriever = new MultiVectorRetriever({
  vectorstore,
  docstore,
  idKey,
});

// We could also add the original chunks to the vectorstore if we wish
// const taggedOriginalDocs = docs.map((doc, i) => {
//   doc.metadata[idKey] = docIds[i];
//   return doc;
// });
// retriever.vectorstore.addDocuments(taggedOriginalDocs);

// Vectorstore alone retrieves the small chunks
const vectorstoreResult = await retriever.vectorstore.similaritySearch(
  "justice breyer"
);
console.log(vectorstoreResult[0].pageContent);
/*
  "What measures will be taken to crack down on corporations overcharging American businesses and consumers?"
*/

// Retriever returns larger result
const retrieverResult = await retriever.getRelevantDocuments("justice breyer");
console.log(retrieverResult[0].pageContent.length);
/*
  9770
*/
