import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ContextualCompressionRetriever } from "langchain/retrievers/contextual_compression";
import { EmbeddingsFilter } from "langchain/retrievers/document_compressors/embeddings_filter";
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { DocumentCompressorPipeline } from "langchain/retrievers/document_compressors";

const embeddingsFilter = new EmbeddingsFilter({
  embeddings: new OpenAIEmbeddings(),
  similarityThreshold: 0.8,
  k: 5,
});

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 200,
  chunkOverlap: 0,
});

const compressorPipeline = new DocumentCompressorPipeline({
  transformers: [textSplitter, embeddingsFilter],
});

const baseRetriever = new TavilySearchAPIRetriever({
  includeRawContent: true,
});

const retriever = new ContextualCompressionRetriever({
  baseCompressor: compressorPipeline,
  baseRetriever,
});

const retrievedDocs = await retriever.invoke(
  "What did the speaker say about Justice Breyer in the 2022 State of the Union?"
);
console.log({ retrievedDocs });

/*
  {
    retrievedDocs: [
      Document {
        pageContent: 'Justice Stephen Breyer talks to President Joe Biden ahead of the State of the Union address on Tuesday. (jabin botsford/Agence France-Presse/Getty Images)',
        metadata: [Object]
      },
      Document {
        pageContent: 'President Biden recognized outgoing US Supreme Court Justice Stephen Breyer during his State of the Union on Tuesday.',
        metadata: [Object]
      },
      Document {
        pageContent: 'What we covered here\n' +
          'Biden recognized outgoing Supreme Court Justice Breyer during his speech',
        metadata: [Object]
      },
      Document {
        pageContent: 'States Supreme Court. Justice Breyer, thank you for your service,” the president said.',
        metadata: [Object]
      },
      Document {
        pageContent: 'Court," Biden said. "Justice Breyer, thank you for your service."',
        metadata: [Object]
      }
    ]
  }
*/
