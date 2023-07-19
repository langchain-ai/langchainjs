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
export function cosineSimilarity(X: number[][], Y: number[][]): number[][] {
  const xTensor = tf.tensor(X);
  const yTensor = tf.tensor(Y);

  if (xTensor.size === 0 || yTensor.size === 0) {
    xTensor.dispose();
    yTensor.dispose();
    return [[]];
  }

  if (xTensor.shape[1] !== yTensor.shape[1]) {
    xTensor.dispose();
    yTensor.dispose();
    throw new Error(
      `Number of columns in X and Y must be the same. X has shape ${xTensor.shape} and Y has shape ${yTensor.shape}.`
    );
  }
  const similarityTensor = tf.tidy(() => {
    const xNorm = tf.norm(xTensor, undefined, 1) as Tensor1D;
    const yNorm = tf.norm(yTensor, undefined, 1) as Tensor1D;
    return tf.divNoNan(
      tf.dot(xTensor, tf.transpose(yTensor)),
      tf.outerProduct(xNorm, yNorm)
    );
  });

  const cosineSimilarity = similarityTensor.arraySync() as number[][];
  xTensor.dispose();
  yTensor.dispose();
  similarityTensor.dispose();

  return cosineSimilarity;
}

/**
 * This function implements the Maximal Marginal Relevance algorithm
 * to select a set of embeddings that maximizes the diversity and relevance to a query embedding.
 *
 * @param {number[]} queryEmbedding - The query embedding.
 * @param {number[][]} embeddingList - The list of embeddings to select from.
 * @param {number} [lambda=0.5] - The trade-off parameter between relevance and diversity.
 * @param {number} [k=4] - The maximum number of embeddings to select.
 *
 * @returns {number[]} The indexes of the selected embeddings in the embeddingList.
 */
export function maximalMarginalRelevance(
  queryEmbedding: number[],
  embeddingList: number[][],
  lambda = 0.5,
  k = 4
): number[] {
  if (Math.min(k, embeddingList.length) <= 0) {
    return [];
  }

  const queryEmbeddingExpanded = (
    Array.isArray(queryEmbedding[0]) ? queryEmbedding : [queryEmbedding]
  ) as number[][];

  const similarityToQuery = cosineSimilarity(
    queryEmbeddingExpanded,
    embeddingList
  )[0];
  const mostSimilarEmbeddingIndex = argMax(similarityToQuery);

  const selectedEmbeddings = [embeddingList[mostSimilarEmbeddingIndex]];
  const selectedEmbeddingsIndexes = [mostSimilarEmbeddingIndex];

  while (selectedEmbeddingsIndexes.length < Math.min(k, embeddingList.length)) {
    let bestScore = -Infinity;
    let bestIndex = -1;

    const similarityToSelected = cosineSimilarity(
      embeddingList,
      selectedEmbeddings
    );

    similarityToQuery.forEach((queryScore, queryScoreIndex) => {
      if (queryScoreIndex in selectedEmbeddingsIndexes) {
        return;
      }
      const maxSimilarityToSelected = Math.max(
        ...similarityToSelected[queryScoreIndex]
      );
      const score =
        lambda * queryScore - (1 - lambda) * maxSimilarityToSelected;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = queryScoreIndex;
      }
    });
    selectedEmbeddings.push(embeddingList[bestIndex]);
    selectedEmbeddingsIndexes.push(bestIndex);
  }

  return selectedEmbeddingsIndexes;
}

/**
 * Finds the index of the maximum value in the given array.
 * @param {number[]} array - The input array.
 *
 * @returns {number} The index of the maximum value in the array. If the array is empty, returns -1.
 */
function argMax(array: number[]): number {
  if (array.length === 0) {
    return -1;
  }

  let maxValue = array[0];
  let maxIndex = 0;

  for (let i = 1; i < array.length; i += 1) {
    if (array[i] > maxValue) {
      maxIndex = i;
      maxValue = array[i];
    }
  }
  return maxIndex;
}
