import { cosine } from "./ml-distance/similarities.js";
import { innerProduct as innerProductDistance } from "./ml-distance/distances.js";
import { euclidean } from "./ml-distance-euclidean/euclidean.js";

type VectorFunction = (xVector: number[], yVector: number[]) => number;

/**
 * Apply a row-wise function between two matrices with the same number of columns.
 *
 * @param {number[][]} X - The first matrix.
 * @param {number[][]} Y - The second matrix.
 * @param {VectorFunction} func - The function to apply.
 *
 * @throws {Error} If the number of columns in X and Y are not the same.
 *
 * @returns {number[][] | [[]]} A matrix where each row represents the result of applying the function between the corresponding rows of X and Y.
 */

export function matrixFunc(
  X: number[][],
  Y: number[][],
  func: VectorFunction
): number[][] {
  if (
    X.length === 0 ||
    X[0].length === 0 ||
    Y.length === 0 ||
    Y[0].length === 0
  ) {
    return [[]];
  }

  if (X[0].length !== Y[0].length) {
    throw new Error(
      `Number of columns in X and Y must be the same. X has shape ${[
        X.length,
        X[0].length,
      ]} and Y has shape ${[Y.length, Y[0].length]}.`
    );
  }

  return X.map((xVector) =>
    Y.map((yVector) => func(xVector, yVector)).map((similarity) =>
      Number.isNaN(similarity) ? 0 : similarity
    )
  );
}

export function normalize(M: number[][], similarity = false): number[][] {
  const max = matrixMaxVal(M);
  return M.map((row) =>
    row.map((val) => (similarity ? 1 - val / max : val / max))
  );
}

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
  return matrixFunc(X, Y, cosine);
}

export function innerProduct(X: number[][], Y: number[][]): number[][] {
  return matrixFunc(X, Y, innerProductDistance);
}

export function euclideanDistance(X: number[][], Y: number[][]): number[][] {
  return matrixFunc(X, Y, euclidean);
}

/**
 * This function implements the Maximal Marginal Relevance algorithm
 * to select a set of embeddings that maximizes the diversity and relevance to a query embedding.
 *
 * @param {number[]|number[][]} queryEmbedding - The query embedding.
 * @param {number[][]} embeddingList - The list of embeddings to select from.
 * @param {number} [lambda=0.5] - The trade-off parameter between relevance and diversity.
 * @param {number} [k=4] - The maximum number of embeddings to select.
 *
 * @returns {number[]} The indexes of the selected embeddings in the embeddingList.
 */
export function maximalMarginalRelevance(
  queryEmbedding: number[] | number[][],
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
  const mostSimilarEmbeddingIndex = argMax(similarityToQuery).maxIndex;

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
      if (selectedEmbeddingsIndexes.includes(queryScoreIndex)) {
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

type MaxInfo = {
  maxIndex: number;
  maxValue: number;
};

/**
 * Finds the index of the maximum value in the given array.
 * @param {number[]} array - The input array.
 *
 * @returns {number} The index of the maximum value in the array. If the array is empty, returns -1.
 */
function argMax(array: number[]): MaxInfo {
  if (array.length === 0) {
    return {
      maxIndex: -1,
      maxValue: NaN,
    };
  }

  let maxValue = array[0];
  let maxIndex = 0;

  for (let i = 1; i < array.length; i += 1) {
    if (array[i] > maxValue) {
      maxIndex = i;
      maxValue = array[i];
    }
  }
  return { maxIndex, maxValue };
}

function matrixMaxVal(arrays: number[][]): number {
  return arrays.reduce(
    (acc, array) => Math.max(acc, argMax(array).maxValue),
    0
  );
}
