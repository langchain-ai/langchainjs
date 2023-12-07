import { Metadata } from "@opensearch-project/opensearch/api/types.js";
import { DataSource, DataSourceOptions, EntitySchema } from "typeorm";
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface that defines the arguments required to create a
 * `TypeORMVectorStore` instance. It includes Postgres connection options,
 * table name, filter, and verbosity level.
 */
export interface TypeORMVectorStoreArgs {
  postgresConnectionOptions: DataSourceOptions;
  tableName?: string;
  filter?: Metadata;
  verbose?: boolean;
}

/**
 * Class that extends the `Document` base class and adds an `embedding`
 * property. It represents a document in the vector store.
 */
export class TypeORMVectorStoreDocument extends Document {
  embedding: string;

  id?: string;
}

const defaultDocumentTableName = "documents";

/**
 * Class that provides an interface to a Postgres vector database. It
 * extends the `VectorStore` base class and implements methods for adding
 * documents and vectors, performing similarity searches, and ensuring the
 * existence of a table in the database.
 */
export class TypeORMVectorStore extends VectorStore {
  declare FilterType: Metadata;

  tableName: string;

  documentEntity: EntitySchema;

  filter?: Metadata;

  appDataSource: DataSource;

  _verbose?: boolean;

  _vectorstoreType(): string {
    return "typeorm";
  }

  private constructor(embeddings: Embeddings, fields: TypeORMVectorStoreArgs) {
    super(embeddings, fields);
    this.tableName = fields.tableName || defaultDocumentTableName;
    this.filter = fields.filter;

    const TypeORMDocumentEntity = new EntitySchema<TypeORMVectorStoreDocument>({
      name: fields.tableName ?? defaultDocumentTableName,
      columns: {
        id: {
          generated: "uuid",
          type: "uuid",
          primary: true,
        },
        pageContent: {
          type: String,
        },
        metadata: {
          type: "jsonb",
        },
        embedding: {
          type: String,
        },
      },
    });
    const appDataSource = new DataSource({
      entities: [TypeORMDocumentEntity],
      ...fields.postgresConnectionOptions,
    });
    this.appDataSource = appDataSource;
    this.documentEntity = TypeORMDocumentEntity;

    this._verbose =
      getEnvironmentVariable("LANGCHAIN_VERBOSE") === "true" ??
      fields.verbose ??
      false;
  }

  /**
   * Static method to create a new `TypeORMVectorStore` instance from a
   * `DataSource`. It initializes the `DataSource` if it is not already
   * initialized.
   * @param embeddings Embeddings instance.
   * @param fields `TypeORMVectorStoreArgs` instance.
   * @returns A new instance of `TypeORMVectorStore`.
   */
  static async fromDataSource(
    embeddings: Embeddings,
    fields: TypeORMVectorStoreArgs
  ): Promise<TypeORMVectorStore> {
    const postgresqlVectorStore = new TypeORMVectorStore(embeddings, fields);

    if (!postgresqlVectorStore.appDataSource.isInitialized) {
      await postgresqlVectorStore.appDataSource.initialize();
    }

    return postgresqlVectorStore;
  }

  /**
   * Method to add documents to the vector store. It ensures the existence
   * of the table in the database, converts the documents into vectors, and
   * adds them to the store.
   * @param documents Array of `Document` instances.
   * @returns Promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    // This will create the table if it does not exist. We can call it every time as it doesn't
    // do anything if the table already exists, and it is not expensive in terms of performance
    await this.ensureTableInDatabase();
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Method to add vectors to the vector store. It converts the vectors into
   * rows and inserts them into the database.
   * @param vectors Array of vectors.
   * @param documents Array of `Document` instances.
   * @returns Promise that resolves when the vectors have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const rows = vectors.map((embedding, idx) => {
      const embeddingString = `[${embedding.join(",")}]`;
      const documentRow = {
        pageContent: documents[idx].pageContent,
        embedding: embeddingString,
        metadata: documents[idx].metadata,
      };

      return documentRow;
    });

    const documentRepository = this.appDataSource.getRepository(
      this.documentEntity
    );

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      try {
        await documentRepository.save(chunk);
      } catch (e) {
        console.error(e);
        throw new Error(`Error inserting: ${chunk[0].pageContent}`);
      }
    }
  }

  /**
   * Method to perform a similarity search in the vector store. It returns
   * the `k` most similar documents to the query vector, along with their
   * similarity scores.
   * @param query Query vector.
   * @param k Number of most similar documents to return.
   * @param filter Optional filter to apply to the search.
   * @returns Promise that resolves with an array of tuples, each containing a `TypeORMVectorStoreDocument` and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[TypeORMVectorStoreDocument, number][]> {
    const embeddingString = `[${query.join(",")}]`;
    const _filter = filter ?? "{}";

    const queryString = `
      SELECT *, embedding <=> $1 as "_distance"
      FROM ${this.tableName}
      WHERE metadata @> $2
      ORDER BY "_distance" ASC
      LIMIT $3;`;

    const documents = await this.appDataSource.query(queryString, [
      embeddingString,
      _filter,
      k,
    ]);

    const results = [] as [TypeORMVectorStoreDocument, number][];
    for (const doc of documents) {
      if (doc._distance != null && doc.pageContent != null) {
        const document = new Document(doc) as TypeORMVectorStoreDocument;
        document.id = doc.id;
        results.push([document, doc._distance]);
      }
    }

    return results;
  }

  /**
   * Method to ensure the existence of the table in the database. It creates
   * the table if it does not already exist.
   * @returns Promise that resolves when the table has been ensured.
   */
  async ensureTableInDatabase(): Promise<void> {
    await this.appDataSource.query("CREATE EXTENSION IF NOT EXISTS vector;");
    await this.appDataSource.query(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
    );

    await this.appDataSource.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "pageContent" text,
        metadata jsonb,
        embedding vector
      );
    `);
  }

  /**
   * Static method to create a new `TypeORMVectorStore` instance from an
   * array of texts and their metadata. It converts the texts into
   * `Document` instances and adds them to the store.
   * @param texts Array of texts.
   * @param metadatas Array of metadata objects or a single metadata object.
   * @param embeddings Embeddings instance.
   * @param dbConfig `TypeORMVectorStoreArgs` instance.
   * @returns Promise that resolves with a new instance of `TypeORMVectorStore`.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: TypeORMVectorStoreArgs
  ): Promise<TypeORMVectorStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }

    return TypeORMVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create a new `TypeORMVectorStore` instance from an
   * array of `Document` instances. It adds the documents to the store.
   * @param docs Array of `Document` instances.
   * @param embeddings Embeddings instance.
   * @param dbConfig `TypeORMVectorStoreArgs` instance.
   * @returns Promise that resolves with a new instance of `TypeORMVectorStore`.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: TypeORMVectorStoreArgs
  ): Promise<TypeORMVectorStore> {
    const instance = await TypeORMVectorStore.fromDataSource(
      embeddings,
      dbConfig
    );
    await instance.addDocuments(docs);

    return instance;
  }

  /**
   * Static method to create a new `TypeORMVectorStore` instance from an
   * existing index.
   * @param embeddings Embeddings instance.
   * @param dbConfig `TypeORMVectorStoreArgs` instance.
   * @returns Promise that resolves with a new instance of `TypeORMVectorStore`.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: TypeORMVectorStoreArgs
  ): Promise<TypeORMVectorStore> {
    const instance = await TypeORMVectorStore.fromDataSource(
      embeddings,
      dbConfig
    );
    return instance;
  }
}
