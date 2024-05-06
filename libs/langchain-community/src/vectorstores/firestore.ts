import {
    VectorStore,
} from '@langchain/core/vectorstores';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { Document } from '@langchain/core/documents';
import {
    AsyncCaller,
    AsyncCallerParams,
} from '@langchain/core/utils/async_caller';
import {
    CollectionReference,
    DocumentData,
    FieldValue,
    Query,
    QueryDocumentSnapshot,
    Filter,
} from 'firebase-admin/firestore'
import {VectorQuerySnapshot} from '@google-cloud/firestore';


/**
 * Type that defines the arguments required to initialize the
 * FirestoreVectorSearch class. It includes the Firestore collection,
 * text key, embedding key.
 *
 * @param collection Firestore collection to store the vectors.
 * @param textKey Corresponds to the plaintext of 'pageContent'.
 * @param embeddingKey Key to store the embedding under.
 */
export interface FirestoreVectorSearchLibArgs extends AsyncCallerParams {
    readonly collection: CollectionReference;
    readonly textKey?: string;
    readonly embeddingKey?: string;
    readonly metadataKey?: string;
}

/**
 * Type that defines the filter used in the
 * similaritySearchVectorWithScore method.
 * It applies a pre-filter query
 */
type FirestoreFilter = Filter

/**
 * Class that is a wrapper around Firestore.
 */
export class FirestoreVectorSearch extends VectorStore {
    declare FilterType: FirestoreFilter;

    private readonly collection: CollectionReference<DocumentData>;

    private readonly textKey: string;

    private readonly embeddingKey: string;

    private readonly metadataKey: string;

    // private caller: AsyncCaller;

    _vectorstoreType(): string {
        return 'firestore';
    }

    constructor(
        embeddings: EmbeddingsInterface,
        args: FirestoreVectorSearchLibArgs
    ) {
        super(embeddings, args);
        this.collection = args.collection;
        this.textKey = args.textKey ?? 'text';
        this.embeddingKey = args.embeddingKey ?? 'embedding';
        this.metadataKey = args.metadataKey ?? 'metadata';
        // this.caller = new AsyncCaller(args);
    }

    /**
     * Method to add vectors and their corresponding documents to Firestore
     * collection.
     * @param vectors Vectors to be added.
     * @param documents Corresponding documents to be added.
     * @returns Promise that resolves when the vectors and documents have been added.
     */
    async addVectors(
        vectors: number[][],
        documents: Document[],
        options?: { ids?: string[] }
    ) {
        const docs = vectors.map((embedding, idx) => ({
            [this.textKey]: documents[idx].pageContent,
            [this.embeddingKey]: embedding,
            [this.metadataKey]: documents[idx].metadata,
        }));
        if (options?.ids === undefined) {
            const batch = this.collection.firestore.batch()
            const newDocIds: string[] = [];

            // Add new documents to the batch
            docs.forEach(doc => {
                const newDocRef = this.collection.doc(); // Generate a new document reference
                batch.set(newDocRef, doc);
                newDocIds.push(newDocRef.id); // Keep track of the generated document IDs
            });

            await batch.commit();
            return newDocIds;
        } else {
            if (options.ids.length !== vectors.length) {
                throw new Error(
                    'If provided, "options.ids" must be an array with the same length as "vectors".'
                );
            }
            const batch = this.collection.firestore.batch()
            const { ids } = options;
            for (let i = 0; i < docs.length; i += 1) {
                const docRef = this.collection.doc(ids[i]);
                // Update the fields you want
                batch.update(docRef, docs[i]);
            }
            await batch.commit()
            return options?.ids
        }
    }

    /**
     * Method to add documents to the Firestore collection. It first converts
     * the documents to vectors using the embeddings and then calls the
     * addVectors method.
     * @param documents Documents to be added.
     * @returns Promise that resolves when the documents have been added.
     */
    async addDocuments(documents: Document[], options?: { ids?: string[] }) {
        const texts = documents.map(({ pageContent }) => pageContent);
        return this.addVectors(
            await this.embeddings.embedDocuments(texts),
            documents,
            options
        );
    }

    /**
     * Method that performs a similarity search on the vectors stored in the
     * Firestore collection. It returns a list of documents and their
     * corresponding similarity scores.
     * @param query Query vector for the similarity search.
     * @param k Number of nearest neighbors to return.
     * @param filter Optional filter to be applied.
     * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
     */
    async similaritySearchVectorWithScore(
        query: number[],
        k: number,
        filter?: FirestoreFilter
    ): Promise<[Document, number][]> {
        let qry: Query = this.collection
        // apply pre-filter query where available
        if (filter) qry = qry.where(filter)
        // apply vector query
        const vectorQuery = qry
            .findNearest(this.embeddingKey, FieldValue.vector(query), {limit:k, distanceMeasure: 'EUCLIDEAN'})
        // make the query
        const vectorQuerySnapshot:VectorQuerySnapshot = await vectorQuery.get();
        // convert the results
        const res = vectorQuerySnapshot.docs.map(
            (doc: QueryDocumentSnapshot):[Document, number] => {
                const docData = doc.data();
                const document = new Document({
                    pageContent: docData[this.textKey],
                    metadata: docData[this.metadataKey],
                });
                const distance = 0; // TODO: await firebase api to return this like docData.distance
                return [document, distance];

            })
        return res;

    }

    /**
     * Static method to create an instance of FirestoreVectorSearch from a
     * list of texts. It first converts the texts to vectors and then adds
     * them to the Firestore collection.
     * @param texts List of texts to be converted to vectors.
     * @param metadatas Metadata for the texts.
     * @param embeddings Embeddings to be used for conversion.
     * @param dbConfig Database configuration for Firestore.
     * @returns Promise that resolves to a new instance of FirestoreVectorSearch.
     */
    static async fromTexts(
        texts: string[],
        metadatas: object[] | object,
        embeddings: EmbeddingsInterface,
        dbConfig: FirestoreVectorSearchLibArgs & { ids?: string[] }
    ): Promise<FirestoreVectorSearch> {
        const docs: Document[] = [];
        for (let i = 0; i < texts.length; i += 1) {
            const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
            const newDoc = new Document({
                pageContent: texts[i],
                metadata,
            });
            docs.push(newDoc);
        }
        return FirestoreVectorSearch.fromDocuments(docs, embeddings, dbConfig);
    }

    /**
     * Static method to create an instance of FirestoreVectorSearch from a
     * list of documents. It first converts the documents to vectors and then
     * adds them to the Firestore collection.
     * @param docs List of documents to be converted to vectors.
     * @param embeddings Embeddings to be used for conversion.
     * @param dbConfig Database configuration for Firestore.
     * @returns Promise that resolves to a new instance of FirestoreVectorSearch.
     */
    static async fromDocuments(
        docs: Document[],
        embeddings: EmbeddingsInterface,
        dbConfig: FirestoreVectorSearchLibArgs & { ids?: string[] }
    ): Promise<FirestoreVectorSearch> {
        const instance = new this(embeddings, dbConfig);
        await instance.addDocuments(docs, { ids: dbConfig.ids });
        return instance;
    }
}
