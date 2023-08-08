import { test, expect } from "@jest/globals";
import { Matrix } from "ml-matrix";
import {
  cosineSimilarity,
  euclideanDistance,
  innerProduct,
  maximalMarginalRelevance,
  normalize,
} from "../math.js";

test("Test cosine similarity zero", async () => {
  const X = Matrix.rand(3, 3).to2DArray();
  const Y = Matrix.zeros(3, 3).to2DArray();
  const expected = Matrix.zeros(3, 3).to2DArray();
  const actual = cosineSimilarity(X, Y);
  expect(actual).toEqual(expected);
});

test("Test cosine similarity identity", async () => {
  const X = Matrix.rand(4, 4).to2DArray();
  const actual = cosineSimilarity(X, X);

  // Diagonal is expected to be [1, 1, 1, 1]
  for (let i = 0; i < 4; i += 1) {
    expect(actual[i][i]).toBeCloseTo(1);
  }
});

test("Test cosine similarity", async () => {
  const X = [
    [1.0, 2.0, 3.0],
    [0.0, 1.0, 0.0],
    [1.0, 2.0, 0.0],
  ];

  const Y = [
    [0.5, 1.0, 1.5],
    [1.0, 0.0, 0.0],
    [2.0, 5.0, 2.0],
    [0.0, 0.0, 0.0],
  ];

  const expected = [
    [1, 0.2672612419124244, 0.8374357893586237, 0],
    [0.5345224838248488, 0, 0.8703882797784892, 0],
    [0.5976143046671968, 0.4472135954999579, 0.9341987329938275, 0],
  ];

  const actual = cosineSimilarity(X, Y);
  expect(actual).toEqual(expected);
});

test("Test cosine similarity empty", async () => {
  const X = [[]];
  const Y = Matrix.rand(3, 3).to2DArray();
  expect(cosineSimilarity(X, X)).toEqual([[]]);
  expect(cosineSimilarity(X, Y)).toEqual([[]]);
});

test("Test cosine similarity wrong shape", async () => {
  const X = Matrix.rand(2, 2).to2DArray();
  const Y = Matrix.rand(2, 4).to2DArray();
  expect(() => cosineSimilarity(X, Y)).toThrowError();
});

test("Test cosine similarity different shape", async () => {
  const X = Matrix.rand(2, 2).to2DArray();
  const Y = Matrix.rand(4, 2).to2DArray();
  expect(() => cosineSimilarity(X, Y)).not.toThrowError();
});

test("Test maximal marginal relevance lambda zero", async () => {
  const queryEmbedding = Matrix.rand(5, 1).to1DArray();
  const zeros = Matrix.zeros(5, 1).to1DArray();
  const embeddingList = [queryEmbedding, queryEmbedding, zeros];

  const expected = [0, 2];
  const actual = maximalMarginalRelevance(queryEmbedding, embeddingList, 0, 2);

  expect(actual).toEqual(expected);
});

test("Test maximal marginal relevance lambda one", async () => {
  const queryEmbedding = Matrix.rand(5, 1).to1DArray();
  const zeros = Matrix.zeros(5, 1).to1DArray();
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
  const randomVector = Matrix.rand(5, 1);

  const queryEmbedding = randomVector.to1DArray();
  const queryEmbedding2D = randomVector.transpose().to2DArray();
  const embeddingList = Matrix.rand(4, 5).to2DArray();

  const first = maximalMarginalRelevance(queryEmbedding, embeddingList, 1, 2);
  const second = maximalMarginalRelevance(
    queryEmbedding2D,
    embeddingList,
    1,
    2
  );

  expect(first).toEqual(second);
});

test("Test maximal marginal relevance has no duplicates", async () => {
  const queryEmbedding = Matrix.rand(1, 1536).to1DArray();
  const embeddingList = Matrix.rand(200, 1536).to2DArray();

  const actual = maximalMarginalRelevance(
    queryEmbedding,
    embeddingList,
    0.5,
    200
  );
  const expected = new Set(actual).size;
  expect(actual).toHaveLength(expected);
});

test("Test normalize", async () => {
  const input = [
    [1, 2],
    [3, 4],
  ];

  const expected = [
    [0.25, 0.5],
    [0.75, 1],
  ];

  const actual = normalize(input);
  expect(actual).toEqual(expected);
});

test("Test innerProduct", async () => {
  const x = [
    [1, 2],
    [5, 6],
  ];
  const y = [
    [3, 4],
    [7, 8],
  ];
  const expected = [
    [11, 23],
    [39, 83],
  ];
  const actual = innerProduct(x, y);
  expect(actual).toEqual(expected);
});

test("Test distance", async () => {
  const x = [[1, 2]];
  const y = [[2, 4]];
  const expected = [[2.23606797749979]];
  const actual = euclideanDistance(x, y);
  expect(actual[0][0]).toBeCloseTo(expected[0][0]);
});
