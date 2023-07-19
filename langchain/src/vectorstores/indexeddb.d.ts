import { similarity as ml_distance_similarity } from "ml-distance";
import { VectorStore } from "langchain/dist/vectorstores/base.js";
import { Embeddings } from "langchain/dist/embeddings/base.js";
import { Document } from "langchain/dist/document.js";
interface MemoryVector {
    content: string;
    embedding: number[];
    metadata: Record<string, any>;
}
export interface IndexedDBVectorStoreArgs {
    dbName?: string;
    storeName?: string;
    dbVersion?: string;
    similarity?: typeof ml_distance_similarity.cosine;
}
export declare class IndexedDBVectorStore extends VectorStore {
    FilterType: (doc: Document) => boolean;
    memoryVectors: MemoryVector[];
    similarity: typeof ml_distance_similarity.cosine;
    constructor(embeddings: Embeddings, { similarity, ...rest }?: IndexedDBVectorStoreArgs);
    addDocuments(documents: Document[]): Promise<void>;
    addVectors(vectors: number[][], documents: Document[]): Promise<void>;
    similaritySearchVectorWithScore(query: number[], k: number, filter?: this["FilterType"]): Promise<[Document, number][]>;
    static fromTexts(texts: string[], metadatas: object[] | object, embeddings: Embeddings, dbConfig?: IndexedDBVectorStoreArgs): Promise<IndexedDBVectorStore>;
    static fromDocuments(docs: Document[], embeddings: Embeddings, dbConfig?: IndexedDBVectorStoreArgs): Promise<IndexedDBVectorStore>;
    static fromExistingIndex(embeddings: Embeddings, dbConfig?: IndexedDBVectorStoreArgs): Promise<IndexedDBVectorStore>;
}
export {};
