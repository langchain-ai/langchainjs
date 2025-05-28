import { BaseDocumentTransformer, Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";

type Sentence = {
  sentence: string;
  combined_sentence_embedding?: number[];
  combined_sentence?: string;
  distance_to_next?: number;
};

type SentenceWithCombinedSentence = Sentence & { combined_sentence: string };
type SentenceWithEmbedding = Sentence & {
  combined_sentence_embedding: number[];
  distance_to_next: number;
};

// Utility function for cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))

  return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0
}

export function combineSentences(
  sentences: Sentence[],
  sentencesToCombine: number = 1
) {
  /**
   * Combine sentences based on buffer size.
   *
   * @param sentences - List of sentences to combine.
   * @param sentencesToCombine - Number of sentences to combine. Defaults to 1.
   * @returns List of sentences with combined sentences.
   */

  for (let i = 0; i < sentences.length; i++) {
    let combinedSentence = "";

    // Add sentences before the current one
    for (let j = i - sentencesToCombine; j < i; j++) {
      if (j >= 0) {
        combinedSentence += sentences[j].sentence + " ";
      }
    }

    // Add the current sentence
    combinedSentence += sentences[i].sentence;

    // Add sentences after the current one
    for (let j = i + 1; j < i + 1 + sentencesToCombine; j++) {
      if (j < sentences.length) {
        combinedSentence += " " + sentences[j].sentence;
      }
    }

    // Store the combined sentence in the current sentence object
    sentences[i].combined_sentence = combinedSentence;
  }

  return sentences as SentenceWithCombinedSentence[];
}

export function calculateCosineDistances(
  sentences: SentenceWithEmbedding[]
): [number[], SentenceWithEmbedding[]] {
  /**
   * Calculate cosine distances between sentences.
   *
   * @param sentences - List of sentences to calculate distances for.
   * @returns Tuple of distances and sentences.
   */

  const distances: number[] = [];

  for (let i = 0; i < sentences.length - 1; i++) {
    const embeddingCurrent = sentences[i].combined_sentence_embedding;
    const embeddingNext = sentences[i + 1].combined_sentence_embedding;

    // Calculate cosine similarity
    const similarity = cosineSimilarity(embeddingCurrent, embeddingNext);

    // Convert to cosine distance
    const distance = 1 - similarity;

    // Append cosine distance to the list
    distances.push(distance);

    // Store distance in the dictionary
    sentences[i].distance_to_next = distance;
  }

  return [distances, sentences];
}

enum BreakpointThresholdType {
  PERCENTILE = "percentile",
  STANDARD_DEVIATION = "standard_deviation",
  INTERQUARTILE = "interquartile",
  GRADIENT = "gradient",
}

const BREAKPOINT_DEFAULTS: Record<BreakpointThresholdType, number> = {
  percentile: 95,
  standard_deviation: 3,
  interquartile: 1.5,
  gradient: 95,
};

interface SemanticChunkerOptions {
  sentencesToCombine?: number;
  sentenceSplitRegex?: RegExp;
  addStartIndex?: boolean;
  breakpointThresholdType?: BreakpointThresholdType;
  breakpointThresholdAmount?: number;
  numberOfChunks?: number;
  minChunkSize?: number;
}

export class SemanticChunker extends BaseDocumentTransformer {
  private sentencesToCombine: number = 1;
  private sentenceSplitRegex: RegExp = new RegExp(`(?<=[.?!])\\s+`);
  private addStartIndex: boolean = false;
  private breakpointThresholdType: BreakpointThresholdType =
    BreakpointThresholdType.PERCENTILE;
  private breakpointThresholdAmount: number =
    BREAKPOINT_DEFAULTS[this.breakpointThresholdType];
  private numberOfChunks?: number;
  private minChunkSize?: number;

  constructor(
    private embeddings: Embeddings,
    options?: SemanticChunkerOptions
  ) {
    super();

    if (options) {
      if (options.sentencesToCombine !== undefined)
        this.sentencesToCombine = options.sentencesToCombine;
      if (options.sentenceSplitRegex !== undefined)
        this.sentenceSplitRegex = new RegExp(options.sentenceSplitRegex);
      if (options.addStartIndex !== undefined)
        this.addStartIndex = options.addStartIndex;
      if (options.breakpointThresholdType !== undefined) {
        this.breakpointThresholdType = options.breakpointThresholdType;
        this.breakpointThresholdAmount =
          BREAKPOINT_DEFAULTS[options.breakpointThresholdType];
      }
      if (options.breakpointThresholdAmount !== undefined)
        this.breakpointThresholdAmount = options.breakpointThresholdAmount;
      if (options.numberOfChunks !== undefined)
        this.numberOfChunks = options.numberOfChunks;
      if (options.minChunkSize !== undefined)
        this.minChunkSize = options.minChunkSize;
    }
  }

  // Utility functions
  private mean(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private std(arr: number[]): number {
    const mean = this.mean(arr);
    return Math.sqrt(
      arr.map((x) => (x - mean) ** 2).reduce((a, b) => a + b, 0) / arr.length
    );
  }

  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(index, 0)];
  }

  private percentileValues(arr: number[], percentiles: number[]): number[] {
    return percentiles.map((p) => this.percentile(arr, p));
  }

  private gradient(arr: number[]): number[] {
    return arr
      .map((_, i, a) => (i === 0 ? a[i + 1] - a[i] : a[i] - a[i - 1]))
      .slice(1);
  }

  private _calculateBreakpointThreshold(
    distances: number[]
  ): [number, number[]] {
    switch (this.breakpointThresholdType) {
      case BreakpointThresholdType.PERCENTILE:
        return [
          this.percentile(distances, this.breakpointThresholdAmount),
          distances,
        ];

      case BreakpointThresholdType.STANDARD_DEVIATION:
        return [
          this.mean(distances) +
            this.breakpointThresholdAmount * this.std(distances),
          distances,
        ];

      case BreakpointThresholdType.INTERQUARTILE:
        const [q1, q3] = this.percentileValues(distances, [25, 75]);
        const iqr = q3 - q1;
        return [
          this.mean(distances) + this.breakpointThresholdAmount * iqr,
          distances,
        ];

      case BreakpointThresholdType.GRADIENT:
        const distanceGradient = this.gradient(distances);
        return [
          this.percentile(distanceGradient, this.breakpointThresholdAmount),
          distanceGradient,
        ];

      default:
        throw new Error(
          `Unexpected breakpointThresholdType: ${this.breakpointThresholdType}`
        );
    }
  }

  private _thresholdFromClusters(distances: number[]): number {
    if (this.numberOfChunks === undefined) {
      throw new Error(
        "This should never be called if `numberOfChunks` is undefined."
      );
    }

    const x1 = distances.length;
    const y1 = 0.0;
    const x2 = 1.0;
    const y2 = 100.0;

    const x = Math.max(Math.min(this.numberOfChunks, x1), x2);
    const y = x2 === x1 ? y2 : y1 + ((y2 - y1) / (x2 - x1)) * (x - x1);

    return this.percentile(distances, Math.min(Math.max(y, 0), 100));
  }

  private async _calculateSentenceDistances(
    singleSentencesList: string[]
  ): Promise<[number[], any[]]> {
    const sentences = combineSentences(
      singleSentencesList.map((sentence) => ({ sentence })),
      this.sentencesToCombine
    );

    const embeddings = await this.embeddings.embedDocuments(
      sentences.map((x) => x.combined_sentence)
    );

    sentences.forEach((sentence, i) => {
      sentence.combined_sentence_embedding = embeddings[i];
    });

    return calculateCosineDistances(sentences as SentenceWithEmbedding[]);
  }

  private _getSingleSentencesList(text: string): string[] {
    return text.split(this.sentenceSplitRegex);
  }

  async splitText(text: string): Promise<string[]> {
    const singleSentencesList = this._getSingleSentencesList(text);

    if (singleSentencesList.length <= 1) return singleSentencesList;

    if (
      this.breakpointThresholdType === BreakpointThresholdType.GRADIENT &&
      singleSentencesList.length === 2
    ) {
      return singleSentencesList;
    }

    const [distances, sentences] = await this._calculateSentenceDistances(
      singleSentencesList
    );
    let breakpointDistanceThreshold: number;
    let breakpointArray: number[];

    if (this.numberOfChunks !== undefined) {
      breakpointDistanceThreshold = this._thresholdFromClusters(distances);
      breakpointArray = distances;
    } else {
      [breakpointDistanceThreshold, breakpointArray] =
        this._calculateBreakpointThreshold(distances);
    }

    const indicesAboveThresh = breakpointArray
      .map((x, i) => (x > breakpointDistanceThreshold ? i : -1))
      .filter((i) => i !== -1);

    const chunks: string[] = [];
    let startIndex = 0;

    for (const index of indicesAboveThresh) {
      const endIndex = index;
      const group = sentences.slice(startIndex, endIndex + 1);
      const combinedText = group.map((d) => d.sentence).join(" ");

      if (
        this.minChunkSize !== undefined &&
        combinedText.length < this.minChunkSize
      )
        continue;
      chunks.push(combinedText);
      startIndex = index + 1;
    }

    if (startIndex < sentences.length) {
      chunks.push(
        sentences
          .slice(startIndex)
          .map((d) => d.sentence)
          .join(" ")
      );
    }

    return chunks;
  }

  async createDocuments(
    texts: string[],
    metadatas?: Record<string, any>[]
  ): Promise<Document[]> {
    const _metadatas = metadatas || Array(texts.length).fill({});
    const documents: Document[] = [];

    for (const [i, text] of texts.entries()) {
      let startIndex = 0;
      const chunks = await this.splitText(text);

      chunks.forEach((chunk) => {
        const metadata = { ..._metadatas[i] };

        if (this.addStartIndex) metadata.start_index = startIndex;

        documents.push(new Document({ pageContent: chunk, metadata }));
        startIndex += chunk.length;
      });
    }

    return documents;
  }

  async splitDocuments(documents: Document[]): Promise<Document[]> {
    const texts: string[] = [];
    const metadatas: Record<string, any>[] = [];

    for (const doc of documents) {
      texts.push(doc.pageContent);
      metadatas.push(doc.metadata);
    }

    return this.createDocuments(texts, metadatas);
  }

  async transformDocuments(documents: Document[]): Promise<Document[]> {
    return this.splitDocuments(documents);
  }
}
