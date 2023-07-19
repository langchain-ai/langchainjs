import { test, expect } from "@jest/globals";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-cpu";
import { cosineSimilarity, maximalMarginalRelevance } from "../math_utils.js";

// tensor memory cleanup
beforeEach(() => tf.engine().startScope(expect.getState().currentTestName));
afterEach(() => tf.engine().endScope(expect.getState().currentTestName));

test("Test cosine similarity zero", async () => {
  const X = tf.randomUniform([3, 3]).arraySync() as number[][];
  const Y = tf.zeros([3, 3]).arraySync() as number[][];
  const expected = tf.zeros([3, 3]).arraySync() as number[][];
  const actual = cosineSimilarity(X, Y);
  expect(actual).toEqual(expected);
});

test("Test cosine similarity identity", async () => {
  const X = tf.randomUniform([4, 4]).arraySync() as number[][];
  const actual = cosineSimilarity(X, X);

  // Diagonal is expected to be [1, 1, 1, 1]
  for (let i = 0; i < 4; i += 1) {
    expect(actual[i][i]).toBeCloseTo(1);
  }
});

test("Test cosine similarity", async () => {
  const X = tf
    .tensor2d([
      [1.0, 2.0, 3.0],
      [0.0, 1.0, 0.0],
      [1.0, 2.0, 0.0],
    ])
    .arraySync() as number[][];

  const Y = tf
    .tensor2d([
      [0.5, 1.0, 1.5],
      [1.0, 0.0, 0.0],
      [2.0, 5.0, 2.0],
      [0.0, 0.0, 0.0],
    ])
    .arraySync() as number[][];

  const expected = tf
    .tensor2d([
      [0.9999999403953552, 0.26726123690605164, 0.8374357223510742, 0],
      [0.5345224738121033, 0, 0.8703882694244385, 0],
      [0.5976142287254333, 0.4472135901451111, 0.9341986775398254, 0],
    ])
    .arraySync() as number[][];

  const actual = cosineSimilarity(X, Y);
  expect(actual).toEqual(expected);
});

test("Test cosine similarity empty", async () => {
  const X = [[]];
  const Y = tf.randomUniform([3, 3]).arraySync() as number[][];
  expect(cosineSimilarity(X, X)).toEqual([[]]);
  expect(cosineSimilarity(X, Y)).toEqual([[]]);
});

test("Test cosine similarity wrong shape", async () => {
  const X = tf.randomUniform([2, 2]).arraySync() as number[][];
  const Y = tf.randomUniform([2, 4]).arraySync() as number[][];
  expect(() => cosineSimilarity(X, Y)).toThrowError();
});

test("Test cosine similarity different shape", async () => {
  const X = tf.randomUniform([2, 2]).arraySync() as number[][];
  const Y = tf.randomUniform([4, 2]).arraySync() as number[][];
  expect(() => cosineSimilarity(X, Y)).not.toThrowError();
});

test("Test cosine similarity memory leaks", async () => {
  const X = tf.randomUniform([3, 3]).arraySync() as number[][];
  const Y = tf.randomUniform([3, 3]).arraySync() as number[][];

  const expected = tf.memory().numTensors;
  cosineSimilarity(X, Y);
  const actual = tf.memory().numTensors;
  expect(actual).toEqual(expected);
});

test("Test maximal marginal relevance lambda zero", async () => {
  const queryEmbedding = tf.randomUniform([5]).arraySync() as number[];
  const zeros = tf.zeros([5]).arraySync() as number[];
  const embeddingList = [queryEmbedding, queryEmbedding, zeros];

  const expected = [0, 2];
  const actual = maximalMarginalRelevance(queryEmbedding, embeddingList, 0, 2);

  expect(actual).toEqual(expected);
});

test("Test maximal marginal relevance lambda one", async () => {
  const queryEmbedding = tf.randomUniform([5]).arraySync() as number[];
  const zeros = tf.zeros([5]).arraySync() as number[];
  const embeddingList = [queryEmbedding, queryEmbedding, zeros];

  const expected = [0, 1];
  const actual = maximalMarginalRelevance(queryEmbedding, embeddingList, 1, 2);

  expect(actual).toEqual(expected);
});

test("Test maximal marginal relevance", async () => {
  // Vectors that are 30, 45 and 75 degrees from query vector (cosine similarity of
  // 0.87, 0.71, 0.26) and the latter two are 15 and 60 degree from the first
  // (cosine similarity 0.97 and 0.71). So for 3rd vector be chosen, must be case that
  // 0.71lambda - 0.97(1 - lambda) < 0.26lambda - 0.71(1-lambda) -> lambda ~< .26 / .71

  const queryEmbedding = [1, 0];
  const embeddingList = [
    [3 ** 0.5, 1],
    [1, 1],
    [1, 2 + 3 ** 0.5],
  ];

  let expected = [0, 2];
  let actual = maximalMarginalRelevance(
    queryEmbedding,
    embeddingList,
    25 / 71,
    2
  );
  expect(actual).toEqual(expected);

  expected = [0, 1];
  actual = maximalMarginalRelevance(queryEmbedding, embeddingList, 27 / 71, 2);
  expect(actual).toEqual(expected);
});

test("Test maximal marginal relevance query dim", async () => {
  const randomTensor = tf.randomUniform([5]);

  const queryEmbedding = randomTensor.arraySync() as number[];
  const queryEmbedding2D = tf
    .reshape(randomTensor, [1, 5])
    .arraySync() as number[];
  const embeddingList = tf.randomUniform([4, 5]).arraySync() as number[][];

  const first = maximalMarginalRelevance(queryEmbedding, embeddingList, 1, 2);
  const second = maximalMarginalRelevance(
    queryEmbedding2D,
    embeddingList,
    1,
    2
  );

  expect(first).toEqual(second);
});

test("Test maximal marginal relevance memory leaks", async () => {
  const queryEmbedding = tf.randomUniform([5]).arraySync() as number[];
  const embeddingList = tf.randomUniform([4, 5]).arraySync() as number[][];

  const expected = tf.memory().numTensors;
  maximalMarginalRelevance(queryEmbedding, embeddingList, 25 / 71, 2);
  const actual = tf.memory().numTensors;
  expect(actual).toEqual(expected);
});
