import * as tf from "@tensorflow/tfjs-core";
import { Tensor1D } from "@tensorflow/tfjs-core";

/**
 * This function calculates the row-wise cosine similarity between two matrices with the same number of columns.
 *
 * @param {number[][]} X - The first matrix.
 * @param {number[][]} Y - The second matrix.
 *
 * @throws {Error} If the number of columns in X and Y are not the same.
 *
 * @returns {number[][] | [[]]} A matrix where each row represents the cosine similarity values between the corresponding rows of X and Y.
 */
export function cosineSimilarity(
  X: number[][],
  Y: number[][]
): Promise<number[][]> {
  const xTensor = tf.tensor(X);
  const yTensor = tf.tensor(Y);

  if (xTensor.size === 0 || yTensor.size === 0) {
    return Promise.resolve([[]]);
  }

  if (xTensor.shape[1] !== yTensor.shape[1]) {
    throw new Error(
      `Number of columns in X and Y must be the same. X has shape ${xTensor.shape} and Y has shape ${yTensor.shape}.`
    );
  }

  const xNorm = tf.norm(xTensor, undefined, 1) as Tensor1D;
  const yNorm = tf.norm(yTensor, undefined, 1) as Tensor1D;
  const cosineSimilarity = tf.divNoNan(
    tf.dot(xTensor, tf.transpose(yTensor)),
    tf.outerProduct(xNorm, yNorm)
  );

  return cosineSimilarity.array() as Promise<number[][]>;
}
