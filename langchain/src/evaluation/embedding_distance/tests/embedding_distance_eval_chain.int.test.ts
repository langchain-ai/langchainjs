import { test } from "@jest/globals";
import {
  EmbeddingDistanceEvalChain,
  PairwiseEmbeddingDistanceEvalChain,
} from "../base.js";
import { OpenAIEmbeddings } from "../../../embeddings/openai.js";

test.skip("Test Embedding Distance", async () => {
  const chain = new EmbeddingDistanceEvalChain({
    embedding: new OpenAIEmbeddings({}, { baseURL: process.env.BASE_URL }),
  });

  console.log("beginning evaluation");
  const res = await chain.evaluateStrings({
    prediction: "I shall go",
    reference: "I shan't go",
  });

  console.log({ res });

  const res1 = await chain.evaluateStrings({
    prediction: "I shall go",
    reference: "I will go",
  });

  console.log({ res1 });
});

test("Test Pairwise Embedding Distance", async () => {
  const chain = new PairwiseEmbeddingDistanceEvalChain({
    embedding: new OpenAIEmbeddings({}, { baseURL: process.env.BASE_URL }),
  });

  console.log("beginning evaluation");
  const res = await chain.evaluateStringPairs({
    prediction: "Seattle is hot in June",
    predictionB: "Seattle is cool in June.",
  });

  console.log({ res });

  const res1 = await chain.evaluateStringPairs({
    prediction: "Seattle is warm in June",
    predictionB: "Seattle is cool in June.",
  });

  console.log({ res1 });
});
