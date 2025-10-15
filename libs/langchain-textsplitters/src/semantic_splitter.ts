/**
 * Semantic text splitter based on semantic similarity.
 * 
 * Inspired by Greg Kamradt's semantic chunking approach:
 * https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb
 */

import { Document, BaseDocumentTransformer } from "@langchain/core/documents";
import type { Embeddings } from "@langchain/core/embeddings";

interface SentenceDict {
  sentence: string;
  index: number;
  combinedSentence?: string;
  combinedSentenceEmbedding?: number[];
}

export function combineSentences(sentences: SentenceDict[], bufferSize: number = 1): SentenceDict[] {
  // Go through each sentence dict
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // Create the combined sentence by combining the sentences within the buffer
    let combinedSentence = "";
    
    // Add sentences before the current one
    for (let j = Math.max(0, i - bufferSize); j < i; j++) {
      combinedSentence += sentences[j].sentence + " ";
    }
    
    // Add the current sentence
    combinedSentence += sentence.sentence;
    
    // Add sentences after the current one
    for (let j = i + 1; j <= Math.min(sentences.length - 1, i + bufferSize); j++) {
      combinedSentence += " " + sentences[j].sentence;
    }
    
    // Assign the combined sentence to the dict
    sentence.combinedSentence = combinedSentence.trim();
  }
  
  return sentences;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

export function calculateCosineDistances(sentences: SentenceDict[]): [number[], SentenceDict[]] {
  const distances: number[] = [];
  
  for (let i = 0; i < sentences.length - 1; i++) {
    const embeddingCurrent = sentences[i].combinedSentenceEmbedding!;
    const embeddingNext = sentences[i + 1].combinedSentenceEmbedding!;
    
    // Calculate cosine similarity
    const similarity = cosineSimilarity(embeddingCurrent, embeddingNext);
    
    // Convert to cosine distance (1 - cosine similarity)
    const distance = 1 - similarity;
    distances.push(distance);
  }
  
  return [distances, sentences];
}

type BreakpointThresholdType = "percentile" | "standard_deviation" | "interquartile" | "gradient";

const BREAKPOINT_DEFAULTS: Record<BreakpointThresholdType, number> = {
  percentile: 95,
  standard_deviation: 3,
  interquartile: 1.5,
  gradient: 95,
};

export interface SemanticChunkerParams {
  embeddings: Embeddings;
  bufferSize?: number;
  addStartIndex?: boolean;
  breakpointThresholdType?: BreakpointThresholdType;
  breakpointThresholdAmount?: number;
  numberOfChunks?: number;
  sentenceSplitRegex?: string;
  minChunkSize?: number;
}

/**
 * Split the text based on semantic similarity.
 *
 * Taken from Greg Kamradt's wonderful notebook:
 * https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb
 *
 * All credits to him.
 *
 * At a high level, this splits into sentences, then groups into groups of 3
 * sentences, and then merges one that are similar in the embedding space.
 */
export class SemanticChunker extends BaseDocumentTransformer {
  lc_namespace = ["langchain", "document_transformers", "text_splitters"];

  private embeddings: Embeddings;
  private bufferSize: number;
  private addStartIndex: boolean;
  private breakpointThresholdType: BreakpointThresholdType;
  private breakpointThresholdAmount: number;
  private numberOfChunks?: number;
  private sentenceSplitRegex: string;
  private minChunkSize?: number;

  constructor(params: SemanticChunkerParams) {
    super();
    this.embeddings = params.embeddings;
    this.bufferSize = params.bufferSize ?? 1;
    this.addStartIndex = params.addStartIndex ?? false;
    this.breakpointThresholdType = params.breakpointThresholdType ?? "percentile";
    this.numberOfChunks = params.numberOfChunks;
    this.sentenceSplitRegex = params.sentenceSplitRegex ?? "(?<=[.?!])\\s+";
    this.minChunkSize = params.minChunkSize;
    
    if (params.breakpointThresholdAmount === undefined) {
      this.breakpointThresholdAmount = BREAKPOINT_DEFAULTS[this.breakpointThresholdType];
    } else {
      this.breakpointThresholdAmount = params.breakpointThresholdAmount;
    }
  }

  private calculateBreakpointThreshold(distances: number[]): [number, number[]] {
    if (this.breakpointThresholdType === "percentile") {
      const sorted = [...distances].sort((a, b) => a - b);
      const index = Math.ceil((this.breakpointThresholdAmount / 100) * sorted.length) - 1;
      return [sorted[Math.max(0, index)], distances];
    } else if (this.breakpointThresholdType === "standard_deviation") {
      const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
      const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
      const stdDev = Math.sqrt(variance);
      return [mean + this.breakpointThresholdAmount * stdDev, distances];
    } else if (this.breakpointThresholdType === "interquartile") {
      const sorted = [...distances].sort((a, b) => a - b);
      const q1Index = Math.floor(0.25 * sorted.length);
      const q3Index = Math.floor(0.75 * sorted.length);
      const q1 = sorted[q1Index];
      const q3 = sorted[q3Index];
      const iqr = q3 - q1;
      const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
      return [mean + this.breakpointThresholdAmount * iqr, distances];
    } else if (this.breakpointThresholdType === "gradient") {
      const distanceGradient: number[] = [];
      for (let i = 0; i < distances.length - 1; i++) {
        distanceGradient.push(distances[i + 1] - distances[i]);
      }
      const sortedGradient = [...distanceGradient].sort((a, b) => a - b);
      const index = Math.ceil((this.breakpointThresholdAmount / 100) * sortedGradient.length) - 1;
      return [sortedGradient[Math.max(0, index)], distanceGradient];
    } else {
      throw new Error(`Got unexpected breakpointThresholdType: ${this.breakpointThresholdType}`);
    }
  }

  private thresholdFromClusters(distances: number[]): number {
    if (this.numberOfChunks === undefined) {
      throw new Error("This should never be called if numberOfChunks is undefined.");
    }
    
    const x1 = distances.length;
    const y1 = 0.0;
    const x2 = 1.0;
    const y2 = 100.0;
    
    const x = Math.max(Math.min(this.numberOfChunks, x1), x2);
    
    let y: number;
    if (x2 === x1) {
      y = y2;
    } else {
      y = y1 + ((y2 - y1) / (x2 - x1)) * (x - x1);
    }
    
    y = Math.min(Math.max(y, 0), 100);
    
    const sorted = [...distances].sort((a, b) => a - b);
    const index = Math.ceil((y / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private async calculateSentenceDistances(singleSentencesList: string[]): Promise<[number[], SentenceDict[]]> {
    const sentences: SentenceDict[] = singleSentencesList.map((sentence, index) => ({
      sentence,
      index,
    }));

    const sentencesWithCombined = combineSentences(sentences, this.bufferSize);
    
    const combinedSentences = sentencesWithCombined.map(s => s.combinedSentence!);
    const embeddings = await this.embeddings.embedDocuments(combinedSentences);
    
    for (let i = 0; i < sentencesWithCombined.length; i++) {
      sentencesWithCombined[i].combinedSentenceEmbedding = embeddings[i];
    }

    return calculateCosineDistances(sentencesWithCombined);
  }

  private getSingleSentencesList(text: string): string[] {
    return text.split(new RegExp(this.sentenceSplitRegex)).filter(sentence => sentence.trim().length > 0);
  }

  async splitText(text: string): Promise<string[]> {
    const singleSentencesList = this.getSingleSentencesList(text);

    if (singleSentencesList.length === 1) {
      return singleSentencesList;
    }

    if (this.breakpointThresholdType === "gradient" && singleSentencesList.length === 2) {
      return singleSentencesList;
    }

    const [distances, sentences] = await this.calculateSentenceDistances(singleSentencesList);

    let breakpointDistanceThreshold: number;
    let breakpointArray: number[];

    if (this.numberOfChunks !== undefined) {
      breakpointDistanceThreshold = this.thresholdFromClusters(distances);
      breakpointArray = distances;
    } else {
      [breakpointDistanceThreshold, breakpointArray] = this.calculateBreakpointThreshold(distances);
    }

    const indicesAboveThresh = breakpointArray
      .map((x, i) => ({ value: x, index: i }))
      .filter(({ value }) => value > breakpointDistanceThreshold)
      .map(({ index }) => index);

    const chunks: string[] = [];
    let startIndex = 0;

    for (const index of indicesAboveThresh) {
      const endIndex = index;
      const group = sentences.slice(startIndex, endIndex + 1);
      const combinedText = group.map((d: SentenceDict) => d.sentence).join(" ");

      if (this.minChunkSize !== undefined && combinedText.length < this.minChunkSize) {
        continue;
      }
      
      chunks.push(combinedText);
      startIndex = index + 1;
    }

    if (startIndex < sentences.length) {
      const combinedText = sentences.slice(startIndex).map((d: SentenceDict) => d.sentence).join(" ");
      chunks.push(combinedText);
    }

    return chunks;
  }

  async createDocuments(
    texts: string[],
    metadatas: Record<string, any>[] = []
  ): Promise<Document[]> {
    const _metadatas = metadatas.length > 0 ? metadatas : texts.map(() => ({}));
    const documents: Document[] = [];
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      let startIndex = 0;
      
      for (const chunk of await this.splitText(text)) {
        const metadata: Record<string, any> = { ..._metadatas[i] };
        if (this.addStartIndex) {
          metadata.start_index = startIndex;
        }
        
        const newDoc = new Document({
          pageContent: chunk,
          metadata,
        });
        
        documents.push(newDoc);
        startIndex += chunk.length;
      }
    }
    
    return documents;
  }

  async splitDocuments(documents: Document[]): Promise<Document[]> {
    const texts = documents.map(doc => doc.pageContent);
    const metadatas = documents.map(doc => doc.metadata);
    return this.createDocuments(texts, metadatas);
  }

  async transformDocuments(documents: Document[]): Promise<Document[]> {
    return this.splitDocuments(documents);
  }
}