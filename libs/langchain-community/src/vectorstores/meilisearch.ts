import { VectorStore } from "@langchain/core/vectorstores";
import * as uuid from "uuid";
import { DocumentInterface } from "@langchain/core/documents";
import { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Filter, Meilisearch } from "meilisearch";
import { Embedders } from "meilisearch";

interface MeilisearchDocument {
    id: string | number;
    _vectors: {
        [embedder_name: string]: number[]; 
    };
    [metadata_key: string]: any;
}

export interface MeilisearchLibArgs {
    client: Meilisearch;
    embedders?: Embedders; 
    index_name?: string;
    text_key?: string;
    metadata_key?: string;
}

/**
 * The MeiliSearch class is a Vector Store implementation that uses the MeiliSearch
 * to store and search for vectors. This class is designed to work with the Langchain
 * Embeddings and Documents classes. This should be compatible with the Langchain's
 * VectorStore interface and is a match for the Langchain Python's MeiliSearch
 * Implementation.
 */
export class MeiliSearchVectorStore extends VectorStore {
    _vectorstoreType():string {
        return "meilisearch";
    }

    client: Meilisearch;
    embeddings: EmbeddingsInterface;
    embedders: Embedders;
    index_name: string = 'langchain_index';
    text_key: string = 'text';
    metadata_key: string = 'metadata';

    /**
     * The MeiliSearch class is a VectorStore implementation that uses the MeiliSearch
     * to store and search for vectors. This class is designed to work with the Langchain
     * Embeddings and Documents classes. This should be compatible with the Langchain's
     * VectorStore interface and is a match for the Langchain Python's MeiliSearch
     * Implementation.
     * 
     * @param embeddings The EmbeddingsInterface implementation to be used for embedding of
     * documents. This is a standard Langchain Embeddings implementation.
     * @param args The MeilisearchLibArgs object that contains the MeiliSearch client and
     * other configuration options.
     * @param args.client The MeiliSearch client to be used for the MeiliSearch operations.
     * @param args.embedders The embedders configuration to be used for the MeiliSearch
     * instance. This is an optional parameter.
     * @param args.index_name The name of the MeiliSearch index to be used. This is an
     * optional parameter and defaults to `langchain_index`.
     * @param args.text_key The key to be used for the text in the metadata. This is an
     * optional parameter and defaults to `text`.
     * @param args.metadata_key The key to be used for the metadata in the MeiliSearch
     * documents. This is an optional parameter and defaults to `metadata`.
     * @returns A new MeiliSearch instance.
     */ 
    constructor(embeddings: EmbeddingsInterface,args:  MeilisearchLibArgs){
        super(embeddings,args);

        if (!args.client) {
            throw new Error("Meilisearch client or host is required");
        }

        this.client = args.client;

        this.index_name = args.index_name ?? "langchain_index";
        this.text_key = args.text_key ?? "text";
        this.metadata_key = args.metadata_key ?? "metadata";
        this.embeddings = embeddings;
        this.embedders = args.embedders ?? {
            "default": {
                "source": "userProvided",
                "dimensions": 1536
            }
        };
    }

    /**
     * Method to create the MeiliSearch Index with the embedders configuration. This
     * method will create the index with the embedders configuration and update the
     * embedders configuration. By default, the index name is `langchain_index` and
     * the embedders configuration is the default configuration.
     * @returns a Promise that resolves to void when the index is created.
     */
    async createMeiliSearchIndex(): Promise<void> {

        let indexExists:boolean = false;

        try {
            await this.client.getIndex(this.index_name);
            indexExists = true;
        } catch (error) {
            indexExists = false;
        }

        if (!indexExists) {
            const creation_result = await this.client.createIndex(this.index_name);
            await this.client.waitForTask(creation_result.taskUid);
            const update_result = await this.client.index(this.index_name).updateEmbedders(this.embedders);
            await this.client.waitForTask(update_result.taskUid);
        }
    }

    /**
     * Method to add documents to the MeiliSearch Instance. This will create the
     * Index if it does not exist. By default, the index name is `langchain_index`
     * and the text key is `text`.
     * @param documents Array of Langchain Documents to be added to the MeiliSearch Index.
     * @returns a Promise that resolves to void when the documents are added.
     */
    async addDocuments(documents: DocumentInterface[]): Promise<void> {
        await this.createMeiliSearchIndex();

        const docs:MeilisearchDocument[] = [];

        for (const doc of documents) {
            const id = uuid.v4();
            const metadata = doc.metadata ?? {};
            const embedding = await this.embeddings.embedDocuments([doc.pageContent]);

            metadata[this.text_key] = doc.pageContent;

            const embedder_name = Object.keys(this.embedders)[0];

            docs.push({
                id: id,
                "_vectors": {
                    [embedder_name]: embedding[0]
                },
                [this.metadata_key]: metadata
            });
        }

        const add_result = await this.client.index(this.index_name).addDocuments(docs);
        await this.client.waitForTask(add_result.taskUid);
        return;
    }

    /**
     * Method to search for similar documents in the MeiliSearch instance. This method
     * will search for similar documents based on the text query provided. By default,
     * the index name is `langchain_index` and the text key is `text`.
     * @param query The text query to be used for the search.
     * @param k The number of documents to be returned.
     * @param filter The filter to be used for the search. This is an optional parameter.
     * and compatible with the MeiliSearch filter format.
     * @returns a Promise that resolves to an array of DocumentInterface objects.
     */
    async similaritySearch(query:string, k: number, filter?: Filter): Promise<DocumentInterface[]> {
        const raw_docs = await this.similaritySearchWithScore(query, k, filter);
        raw_docs.sort((a, b) => b[1] - a[1]);
        const docs:DocumentInterface[] = raw_docs.map((doc) => doc[0]);
        return docs;
    }


    /**
     * Method to search for similar documents in the MeiliSearch instance and return them
     * along with their similarity scores. This method will search for similar documents
     * based on the text query provided. By default, the index name is `langchain_index`
     * and the text key is `text`.
     * @param query The text query to be used for the search.
     * @param k The number of documents to be returned.
     * @param filter The filter to be used for the search. This is an optional parameter
     * and compatible with the MeiliSearch filter format.
     * @returns a Promise that resolves to an array of tuples, each containing a DocumentInterface
     * object and its corresponding similarity score.
     */
    async similaritySearchWithScore(query: string, k: number, filter?: Filter): Promise<[DocumentInterface, number][]> {
        const embedding = await this.embeddings.embedDocuments([query]);
        const docs = await this.similaritySearchVectorWithScore(embedding[0], k, filter);
        return docs;
    }

    /**
     * Method to search for similar documents in the MeiliSearch instance and return them
     * along with their similarity scores. This method will search for similar documents
     * based on the vector query provided. By default, the index name is `langchain_index`
     * and the text key is `text`.
     * @param query The vector query to be used for the search.
     * @param k The number of documents to be returned.
     * @param filter The filter to be used for the search. This is an optional parameter
     * and compatible with the MeiliSearch filter format.
     * @returns a Promise that resolves to an array of tuples, each containing a DocumentInterface
     * object and its corresponding similarity score.
     */
    async similaritySearchVectorWithScore(query: number[], k: number, filter?: Filter): Promise<[DocumentInterface, number][]> {
        const docs:[DocumentInterface, number][] = [];
        const embedder_name = Object.keys(this.embedders)[0];

        const search_result = await this.client.index(this.index_name).search(
            "",
            {
                "vector": query,
                "hybrid": {"semanticRatio": 1.0, "embedder": embedder_name},
                "limit": k,
                "filter": filter,
                "showRankingScore": true,
            },
        );

        for (const hit of search_result.hits) {
            const metadata = hit[this.metadata_key];
            if (metadata && this.text_key in metadata){
                const text = metadata.text;
                const semantic_score = hit._rankingScore;

                const { [this.text_key]: omitted, ...filteredMetadata } = metadata;
                
                docs.push([
                    {
                        pageContent: text,
                        metadata: filteredMetadata,
                    },
                    semantic_score
                ]);
            }
        }

        return docs;
    }

    /**
     * For MeiliSearch, the `addVectors` method is not implemented. This is because
     * MeiliSearch is not designed to work this way since V1.5.1. 
     */
    addVectors(vectors: number[][], documents: DocumentInterface[], options?: { [x: string]: any; }): Promise<string[] | void> {
        throw new Error("Method need not implemented.");
    }

    /**
     * Delete the MeiliSearch index. This method will delete the MeiliSearch index.
     * @returns a Promise that resolves to void when the index is deleted.
     */
    async deleteIndex(): Promise<void> {
        const delete_result = await this.client.deleteIndex(this.index_name);
        await this.client.waitForTask(delete_result.taskUid);
        return;
    }

    /**
     * Delete all documents in the MeiliSearch index. This method will delete all
     * documents in the MeiliSearch index.
     * @returns a Promise that resolves to void when the documents are deleted.
     */
    async deleteAllDocuments(): Promise<void> {
        const delete_result = await this.client.index(this.index_name).deleteAllDocuments();
        await this.client.waitForTask(delete_result.taskUid);
        return;
    }

    /**
     * Enable the Vector Store in the MeiliSearch instance. This method will enable
     * the Vector Store in the MeiliSearch instance.
     * @returns a Promise that resolves to void when the Vector Store is enabled.
     * @throws an Error if the Vector Store is failed to enable.
     */
    async enableVectorStore(): Promise<void> {
        const result = await this.client.httpRequest.patch('/experimental-features', {
            vectorStore: true
        });

        if (result.status !== 200 && result.vectorStore !== true) {
            throw new Error("Failed to enable vector store");
        } else {
            return;
        }
    }

    /**
     * Check if the MeiliSearch instance is healthy. This method will check if the
     * MeiliSearch instance is healthy.
     * @returns a Promise that resolves to true if the MeiliSearch instance is healthy
     * and false if it is not.
     */
    async isHealthy(): Promise<boolean> {
        try {
            await this.client.health();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Create a MeiliSearch instance from a list of texts and their corresponding
     * metadata. This method will create a MeiliSearch instance from the texts and
     * metadata provided.
     * 
     * @param texts The list of texts to be used for the MeiliSearch instance.
     * @param metadatas The list of metadata objects to be used for the MeiliSearch
     * instance. This can be a single metadata object or a list of metadata objects.
     * @param embeddings The EmbeddingsInterface implementation to be used for embedding
     * the texts.
     * @param args The MeilisearchLibArgs object that contains the MeiliSearch client and
     * other configuration options.
     * @returns a Promise that resolves to a new MeiliSearch instance.
     */
    static async fromTexts(
        texts: string[],
        metadatas: object[] | object,
        embeddings: EmbeddingsInterface,
        args: MeilisearchLibArgs
    ): Promise<MeiliSearchVectorStore> {
        const docs: DocumentInterface[] = texts.map((text, idx) => {
            return {
                pageContent: text,
                metadata: metadatas instanceof Array ? metadatas[idx] : metadatas,
            };
        });
        const meilisearch = await MeiliSearchVectorStore.fromDocuments(docs, embeddings, args);
        return meilisearch;
    }

    /**
     * Create a MeiliSearch instance from a list of Langchain Documents. This method
     * will create a MeiliSearch instance from the list of Langchain Documents provided.
     * 
     * @param documents The list of Langchain Documents to be used for the MeiliSearch
     * instance.
     * @param embeddings The EmbeddingsInterface implementation to be used for embedding
     * the documents.
     * @param args The MeilisearchLibArgs object that contains the MeiliSearch client and
     * other configuration options.
     * @returns a Promise that resolves to a new MeiliSearch instance.
     */
    static async fromDocuments(
        documents: DocumentInterface[],
        embeddings: EmbeddingsInterface,
        args: MeilisearchLibArgs
    ): Promise<MeiliSearchVectorStore> {
        const meilisearch = new MeiliSearchVectorStore(embeddings, args);
        await meilisearch.addDocuments(documents);
        return meilisearch;
    }

    /**
     * Create a MeiliSearch instance from an existing index. This method will create a
     * MeiliSearch instance from an existing index.
     * 
     * @param embeddings The EmbeddingsInterface implementation to be used for embedding
     * the documents.
     * @param args The MeilisearchLibArgs object that contains the MeiliSearch client and
     * other configuration options.
     * @returns a Promise that resolves to a new MeiliSearch instance.
     */
    static async fromExistingIndex(
        embeddings: EmbeddingsInterface,
        args: MeilisearchLibArgs
    ): Promise<MeiliSearchVectorStore> {
        return new MeiliSearchVectorStore(embeddings, args);
    }
}