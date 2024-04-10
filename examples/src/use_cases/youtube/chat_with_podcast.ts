import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { SearchApiLoader } from "langchain/document_loaders/web/searchapi";
import { TokenTextSplitter } from "langchain/text_splitter";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const loader = new SearchApiLoader({
  engine: "youtube_transcripts",
  video_id: "WTOm65IZneg",
});

const docs = await loader.load();

const textSplitterQA = new TokenTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const docsQA = await textSplitterQA.splitDocuments(docs);

const llm = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
  temperature: 0.2,
});

const embeddings = new OpenAIEmbeddings();

const vectorstore = await FaissStore.fromDocuments(docsQA, embeddings);

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

const qaChain = await createRetrievalChain({
  retriever: vectorstore.asRetriever(),
  combineDocsChain,
});

const question = "How many people did he want to help?";

const result = await qaChain.invoke({ input: question });

console.log(result.answer);

/*
  MrBeast wanted to help 1,000 deaf people hear again. He and his team were able to help over 40 people at the time of the video, and they were on their way to reaching their goal of 1,000.
*/
