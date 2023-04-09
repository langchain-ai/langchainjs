import type {
  SparseValues,
  VectorOperationsApi,
} from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch";
import { BertTokenizer } from "bert-tokenizer";

import { PineconeLibArgs, PineconeMetadata } from "vectorstores/pinecone.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { BaseRetriever } from "../schema/index.js";

export interface PineconeHybridSearchParams extends PineconeLibArgs {
  tokenizer: BertTokenizer;
  topK: number;
  alpha: number;
}

export class PineconeHybridSearchRetriever extends BaseRetriever {
  embeddings: Embeddings;

  pineconeIndex: VectorOperationsApi;

  tokenizer: BertTokenizer;

  topK = 4;

  alpha = 0.5;

  textKey: string;

  namespace?: string;

  filter?: PineconeMetadata;

  constructor(embeddings: Embeddings, args: PineconeHybridSearchParams) {
    super();
    this.embeddings = embeddings;
    this.pineconeIndex = args.pineconeIndex;
    this.tokenizer = args.tokenizer;
    this.topK = args.topK;
    this.alpha = args.alpha;
    this.namespace = args.namespace;
    this.textKey = args.textKey ?? "text";
    this.filter = args.filter;
  }

  buildDict(inputBatch: number[][]): SparseValues[] {
    return inputBatch.map((tokenIds) => {
      const tokenCounts = tokenIds.reduce((acc, tokenId) => {
        acc[tokenId] = (acc[tokenId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      return {
        indices: Object.keys(tokenCounts).map(Number),
        values: Object.values(tokenCounts),
      };
    });
  }

  async addTexts(texts: string[]): Promise<void> {
    const batchSize = 32;

    for (let i = 0; i < texts.length; i += batchSize) {
      const iEnd = Math.min(i + batchSize, texts.length);
      const contextBatch = texts.slice(i, iEnd);
      const ids = Array.from({ length: iEnd - i }, (_, idx) =>
        (i + idx).toString()
      );
      const meta = contextBatch.map((context) => ({ context }));

      const denseEmbeds = await this.embeddings.embedDocuments(contextBatch);
      const tokenIdsBatch = contextBatch.map((text) =>
        this.tokenizer.tokenize(text)
      );
      const sparseEmbeds = this.buildDict(tokenIdsBatch);

      const vectors = ids.map((id, idx) => ({
        id,
        sparse_values: sparseEmbeds[idx],
        values: denseEmbeds[idx],
        metadata: meta[idx],
      }));

      await this.pineconeIndex.upsert({
        upsertRequest: { vectors, namespace: this.namespace },
      });
    }
  }

  hybridScale(
    dense: number[],
    sparse: SparseValues,
    alpha: number
  ): [number[], SparseValues] {
    if (alpha < 0 || alpha > 1) {
      throw new Error("Alpha must be between 0 and 1");
    }

    const hsparse: SparseValues = {
      indices: sparse.indices,
      values: sparse.values.map((v) => v * (1 - alpha)),
    };

    const hdense = dense.map((v) => v * alpha);

    return [hdense, hsparse];
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const tokenIds = await this.tokenizer.tokenize(query);
    const sparseVec = this.buildDict([tokenIds])[0];
    const denseVec = await this.embeddings.embedQuery(query);
    const [scaledDenseVec, scaledSparseVec] = this.hybridScale(
      denseVec,
      sparseVec,
      this.alpha
    );

    const results = await this.pineconeIndex.query({
      queryRequest: {
        namespace: this.namespace,
        filter: this.filter,
        vector: scaledDenseVec,
        sparseVector: scaledSparseVec,
        topK: this.topK,
        includeMetadata: true,
      },
    });

    const result: Document[] = [];

    if (results.matches) {
      for (const res of results.matches) {
        const { [this.textKey]: pageContent, ...metadata } = (res.metadata ??
          {}) as PineconeMetadata;
        result.push(new Document({ metadata, pageContent }));
      }
    }

    return result;
  }
}
