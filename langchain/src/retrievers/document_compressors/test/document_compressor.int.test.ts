import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "../../../embeddings/openai.js";
import { RecursiveCharacterTextSplitter } from "../../../text_splitter.js";
import { EmbeddingsFilter } from "../embeddings_filter.js";
import { DocumentCompressorPipeline } from "../index.js";
import { Document } from "../../../document.js";

test("Test DocumentCompressorPipeline", async () => {
  const embeddings = new OpenAIEmbeddings();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 30,
    chunkOverlap: 0,
    separators: [". "],
  });
  const relevantFilter = new EmbeddingsFilter({
    embeddings,
    similarityThreshold: 0.8,
  });
  const pipelineFilter = new DocumentCompressorPipeline({
    transformers: [splitter, relevantFilter],
  });

  const texts = ["This sentence is about cows", "foo bar baz"];

  const docs = [new Document({ pageContent: texts.join(". ") })];
  const actual = await pipelineFilter.compressDocuments(
    docs,
    "Tell me about farm animals"
  );

  expect(actual.length).toBe(1);
  expect(texts[0].includes(actual[0].pageContent)).toBeTruthy();
});
