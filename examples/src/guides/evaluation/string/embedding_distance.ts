import { loadEvaluator } from "langchain/evaluation";
import { FakeEmbeddings } from "langchain/embeddings/fake";

const chain = await loadEvaluator("embedding_distance");

const res = await chain.evaluateStrings({
  prediction: "I shall go",
  reference: "I shan't go",
});

console.log({ res });

/*
{ res: { score: 0.09664669666115833 } }
 */

const res1 = await chain.evaluateStrings({
  prediction: "I shall go",
  reference: "I will go",
});

console.log({ res1 });

/*
{ res1: { score: 0.03761174400183265 } }
 */

// Select the Distance Metric
// By default, the evalutor uses cosine distance. You can choose a different distance metric if you'd like.
const evaluator = await loadEvaluator("embedding_distance", {
  distanceMetric: "euclidean",
});

// Select Embeddings to Use
// The constructor uses OpenAI embeddings by default, but you can configure this however you want. Below, use huggingface local embeddings

const embedding = new FakeEmbeddings();

const customEmbeddingEvaluator = await loadEvaluator("embedding_distance", {
  embedding,
});

const res2 = await customEmbeddingEvaluator.evaluateStrings({
  prediction: "I shall go",
  reference: "I shan't go",
});

console.log({ res2 });

/*
{ res2: { score: 2.220446049250313e-16 } }
 */

const res3 = await customEmbeddingEvaluator.evaluateStrings({
  prediction: "I shall go",
  reference: "I will go",
});

console.log({ res3 });

/*
{ res3: { score: 2.220446049250313e-16 } }
 */
