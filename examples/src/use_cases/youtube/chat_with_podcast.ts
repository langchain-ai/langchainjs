import { RetrievalQAChain } from "langchain/chains";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { SearchApiLoader } from "langchain/document_loaders/web/searchapi";
import { TokenTextSplitter } from "langchain/text_splitter";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

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

const llm_question_answer = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-16k",
  temperature: 0.2,
});

const embeddings = new OpenAIEmbeddings();

const db = await FaissStore.fromDocuments(await docsQA, embeddings);

const qa = RetrievalQAChain.fromLLM(llm_question_answer, db.asRetriever(), {
  verbose: true,
});

const question = "How many people he wanted to help?";

const answer = await qa.run(question);

console.log(answer);

/**
 * He wanted to help 1,000 deaf people.
 */
