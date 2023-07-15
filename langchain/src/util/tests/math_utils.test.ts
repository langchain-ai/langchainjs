import { test, expect } from "@jest/globals";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-cpu";
import { cosineSimilarity } from "../math_utils.js";

test("Test cosine similarity zero", async () => {
  const X = tf.randomUniform([3, 3]).arraySync() as number[][];
  const Y = tf.zeros([3, 3]).arraySync() as number[][];
  const expected = tf.zeros([3, 3]).arraySync() as number[][];
  const actual = await cosineSimilarity(X, Y);
  expect(actual).toEqual(expected);
});

test("Test cosine similarity identity", async () => {
  const X = tf.randomUniform([4, 4]).arraySync() as number[][];
  const actual = await cosineSimilarity(X, X);

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

  const actual = await cosineSimilarity(X, Y);
  expect(actual).toEqual(expected);
});

test("Test cosine similarity empty", async () => {
  const X = [[]];
  const Y = tf.randomUniform([3, 3]).arraySync() as number[][];
  expect(await cosineSimilarity(X, X)).toEqual([[]]);
  expect(await cosineSimilarity(X, Y)).toEqual([[]]);
});

test("Test cosine similarity wrong shape", async () => {
  const X = tf.randomUniform([2, 2]).arraySync() as number[][];
  const Y = tf.randomUniform([2, 4]).arraySync() as number[][];
  expect(() => cosineSimilarity(X, Y)).toThrowError();
});

test("Test cosine similarity correct shape", async () => {
  const X = tf.randomUniform([2, 2]).arraySync() as number[][];
  const Y = tf.randomUniform([4, 2]).arraySync() as number[][];
  expect(() => cosineSimilarity(X, Y)).not.toThrowError();
});
