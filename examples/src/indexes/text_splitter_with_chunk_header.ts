import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";

const splitter = new CharacterTextSplitter({
  chunkSize: 1536,
  chunkOverlap: 200,
});

const jimDocs = await splitter.createDocuments(
  [`My favorite color is blue.`],
  [],
  {
    chunkHeader: `DOCUMENT NAME: Jim Interview\n\n---\n\n`,
    appendChunkOverlapHeader: true,
  }
);

const pamDocs = await splitter.createDocuments(
  [`My favorite color is red.`],
  [],
  {
    chunkHeader: `DOCUMENT NAME: Pam Interview\n\n---\n\n`,
    appendChunkOverlapHeader: true,
  }
);

const vectorstore = await HNSWLib.fromDocuments(
  jimDocs.concat(pamDocs),
  new OpenAIEmbeddings()
);

const llm = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
  temperature: 0,
});

const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Answer the user's questions based on the below context:\n\n{context}",
  ],
  ["human", "{input}"],
]);

const combineDocsChain = await createStuffDocumentsChain({
  llm,
  prompt: questionAnsweringPrompt,
});

const chain = await createRetrievalChain({
  retriever: vectorstore.asRetriever(),
  combineDocsChain,
});

const res = await chain.invoke({
  input: "What is Pam's favorite color?",
});

console.log(JSON.stringify(res, null, 2));

/*
  {
    "input": "What is Pam's favorite color?",
    "chat_history": [],
    "context": [
      {
        "pageContent": "DOCUMENT NAME: Pam Interview\n\n---\n\nMy favorite color is red.",
        "metadata": {
          "loc": {
            "lines": {
              "from": 1,
              "to": 1
            }
          }
        }
      },
      {
        "pageContent": "DOCUMENT NAME: Jim Interview\n\n---\n\nMy favorite color is blue.",
        "metadata": {
          "loc": {
            "lines": {
              "from": 1,
              "to": 1
            }
          }
        }
      }
    ],
    "answer": "Pam's favorite color is red."
  }
*/
