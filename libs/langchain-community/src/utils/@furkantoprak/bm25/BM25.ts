/**
 * Adapted from
 * https://github.com/FurkanToprak/OkapiBM25
 *
 * Inlined due to CJS import issues.
 */

/** Gets word count. */
export const getWordCount = (corpus: string) => {
  return ((corpus || "").match(/\w+/g) || []).length;
};

/** Number of occurences of a word in a string. */
export const getTermFrequency = (term: string, corpus: string) => {
  // Escape any RegExp metacharacters in the term so constructing a RegExp
  // from user-provided or model-generated queries does not throw an error
  const escaped = (term || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return ((corpus || "").match(new RegExp(escaped, "g")) || []).length;
};

/** Inverse document frequency. */
export const getIDF = <T>(term: string, documents: BMInputDocument<T>[]) => {
  // Number of relevant documents.
  const relevantDocuments = documents.filter((document) =>
    document.text.includes(term)
  ).length;
  return Math.log(
    (documents.length - relevantDocuments + 0.5) / (relevantDocuments + 0.5) + 1
  );
};

export interface BMInputDocument<T> {
  /** The text from the original document */
  text: string;
  /** The original document */
  document: T;
}

/** Represents a document; useful when sorting results.
 */
export interface BMOutputDocument<T> {
  /** The original document */
  document: T;
  /** The score that the document receives. */
  score: number;
}

/** Constants that are free parameters used in BM25, specifically when generating inverse document frequency. */
export interface BMConstants {
  /** Free parameter. Is 0.75 by default.  */
  b?: number;
  /** Free parameter. Is 1.2 by default. Generally in range [1.2, 2.0] */
  k1?: number;
}

/** If returns positive, the sorting results in secondEl coming before firstEl, else, firstEl comes before secondEL  */
export type BMSorter<T> = (
  firstEl: BMOutputDocument<T>,
  secondEl: BMOutputDocument<T>
) => number;

/** Implementation of Okapi BM25 algorithm.
 *  @param documents: Collection of documents with text content and associated data.
 *  @param keywords: query terms.
 *  @param constants: Contains free parameters k1 and b. b=0.75 and k1=1.2 by default.
 *  @param sorter: A function that allows you to sort results by a given rule. If not provided, returns results in the original document order.
 */
export function BM25<T>(
  documents: BMInputDocument<T>[],
  keywords: string[],
  constants?: BMConstants,
  sorter?: BMSorter<T>
): BMOutputDocument<T>[] {
  const b = constants && constants.b ? constants.b : 0.75;
  const k1 = constants && constants.k1 ? constants.k1 : 1.2;
  const documentLengths = documents.map((document) =>
    getWordCount(document.text)
  );
  const averageDocumentLength =
    documentLengths.reduce((a, b) => a + b, 0) / documents.length;
  const idfByKeyword = keywords.reduce((obj, keyword) => {
    obj.set(keyword, getIDF(keyword, documents));
    return obj;
  }, new Map<string, number>());

  const scoredDocs = documents.map(({ text, document }, index) => {
    const score = keywords
      .map((keyword: string) => {
        const inverseDocumentFrequency = idfByKeyword.get(keyword);
        if (inverseDocumentFrequency === undefined) {
          throw new Error("Missing keyword.");
        }
        const termFrequency = getTermFrequency(keyword, text);
        const documentLength = documentLengths[index];
        return (
          (inverseDocumentFrequency * (termFrequency * (k1 + 1))) /
          (termFrequency +
            k1 * (1 - b + (b * documentLength) / averageDocumentLength))
        );
      })
      .reduce((a: number, b: number) => a + b, 0);
    return { score, document } as BMOutputDocument<T>;
  });
  // sort the results
  if (sorter) {
    return scoredDocs.sort(sorter);
  }
  return scoredDocs;
}
