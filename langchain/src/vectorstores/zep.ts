import {Document as ZepDocument, DocumentCollection, NotFoundError, ZepClient} from "@getzep/zep-js";

import {VectorStore} from "./base.js";
import {Embeddings} from "../embeddings/base.js";
import {Document} from "../document.js";


export interface IZepArgs {
    collection: DocumentCollection;
}

export interface IZepConfig {
    apiUrl: string;
    apiKey: string;
    collectionName: string;
    description?: string;
    metadata?: Record<string, any>;
    embeddingDimensions?: number;
    isAutoEmbedded?: boolean;
}

export interface IZepDeleteParams {
    uuids: string[];
}

export class ZepVectorStore extends VectorStore {
    private client: ZepClient;

    private collection: DocumentCollection;

    constructor(embeddings: Embeddings, args: IZepConfig) {
        super(embeddings, args);

        this.initCollection(args).catch(err => {
            console.error('Error retrieving collection:', err);
        });
        this.embeddings = embeddings;
    }

    private async initCollection(args: IZepConfig) {
        this.client = await ZepClient.init(args.apiUrl, args.apiKey);
        try {
            this.collection = await this.client.document.getCollection(args.collectionName);
        } catch (err) {
            // eslint-disable-next-line no-instanceof/no-instanceof
            if (err instanceof NotFoundError) {
                await this.createCollection(args);
            } else {
                throw err;
            }
        }
    }

    private async createCollection(args: IZepConfig) {
        if (!args.embeddingDimensions || !args.isAutoEmbedded) {
            throw new Error(`Collection ${args.collectionName} not found. 
 You can create a new Collection by providing embeddingDimensions and isAutoEmbedded.`);
        }
        this.collection = await this.client.document.addCollection({
            name: args.collectionName,
            description: args.description,
            metadata: args.metadata,
            embeddingDimensions: args.embeddingDimensions,
            isAutoEmbedded: args.isAutoEmbedded
        });
    }

    async addVectors(vectors: number[][], documents: Document[]): Promise<string[]> {
        if (vectors.length === 0) {
            return [];
        }
        if (vectors.length !== documents.length) {
            throw new Error(`Vectors and documents must have the same length`);
        }

        const docs: Array<ZepDocument> = [];
        for (let i = 0; i < documents.length; i += 1) {
            const doc = new ZepDocument(
                {
                    content: documents[i].pageContent,
                    metadata: documents[i].metadata,
                    embedding: new Float32Array(vectors[i])
                });
            docs.push(doc);
        }
        return await this.collection.addDocuments(docs);
    }

    async addDocuments(documents: Document[]): Promise<string[]> {
        const texts = documents.map(({pageContent}) => pageContent);
        const vectors = await this.embeddings.embedDocuments(texts);
        return this.addVectors(vectors, documents);
    }

    _vectorstoreType(): string {
        return "zep";
    }

    async delete(params: IZepDeleteParams): Promise<void> {
        for (const uuid of params.uuids) {
            await this.collection.deleteDocument(uuid);
        }
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object'
            && value !== null
            && !Array.isArray(value)
            // eslint-disable-next-line no-instanceof/no-instanceof
            && !(value instanceof Function);
    }


    async similaritySearchVectorWithScore(
        query: number[],
        k: number,
        filter?: Record<string, unknown> | string | object
    ): Promise<[Document, number][]> {
        if (!this.isRecord(filter)) {
            throw new Error(`Filter must be a record, got ${filter}`);
        }
        const results = await this.collection.search({
            embedding: new Float32Array(query),
            metadata: filter
        }, k);

        const docsAndScore: [Document, number][] = [];
        results.forEach((d) => {
            docsAndScore.push([
                new Document({
                    pageContent: d.content,
                    metadata: d.metadata,
                }),
                d.score ? d.score : 0
            ]);
        });
        return docsAndScore;
    }


    static async fromTexts(
        texts: string[],
        metadatas: object[] | object,
        embeddings: Embeddings,
        zepConfig: IZepConfig
    ): Promise<ZepVectorStore> {
        const docs: Document[] = [];
        for (let i = 0; i < texts.length; i += 1) {
            const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
            const newDoc = new Document({
                pageContent: texts[i],
                metadata,
            });
            docs.push(newDoc);
        }
        return ZepVectorStore.fromDocuments(docs, embeddings, zepConfig);
    }

    static async fromDocuments(
        docs: Document[],
        embeddings: Embeddings,
        zepConfig: IZepConfig
    ): Promise<ZepVectorStore> {
        const instance = new this(embeddings, zepConfig);
        await instance.addDocuments(docs);
        return instance;
    }
}