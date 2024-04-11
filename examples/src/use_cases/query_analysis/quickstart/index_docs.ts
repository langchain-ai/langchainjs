import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { getDocs } from "./docs.js";

const docs = await getDocs();
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 2000 });
const chunkedDocs = await textSplitter.splitDocuments(docs);
const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
});
const vectorStore = await Chroma.fromDocuments(chunkedDocs, embeddings, {
  collectionName: "yt-videos",
});
