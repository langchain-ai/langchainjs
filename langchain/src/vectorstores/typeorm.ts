import { Metadata } from "@opensearch-project/opensearch/api/types.js";
import { DataSource, DataSourceOptions, EntitySchema } from "typeorm";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { getEnvironmentVariable } from "../util/env.js";
import {
  getSourceNameFromDocument,
  getSourceTypeFromDocument,
  getUniqueIDFromDocument,
} from "../util/document_utils.js";

export interface TypeORMVectorStoreArgs {
  postgresConnectionOptions: DataSourceOptions;
  tableName?: string;
  filter?: Metadata;
  verbose?: boolean;
}

export class TypeORMVectorStoreDocument extends Document {
  embedding: string;
}

const defaultDocumentTableName = "documents";

export class TypeORMVectorStore extends VectorStore {
  declare FilterType: Metadata;

  tableName: string;

  documentEntity: EntitySchema;

  filter?: Metadata;

  appDataSource: DataSource;

  _verbose?: boolean;

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
              sourceType: {
                  type: String,
              },
              sourceName: {
                  type: String,
              },
              hash: {
                  type: String,
              },
          },
      });
      this.appDataSource = new DataSource({
          entities: [TypeORMDocumentEntity],
          ...fields.postgresConnectionOptions,
      });
      this.documentEntity = TypeORMDocumentEntity;

      this._verbose =
        getEnvironmentVariable("LANGCHAIN_VERBOSE") === "true" ??
        fields.verbose ??
        false;
  }

  static async fromDataSource(
    embeddings: Embeddings,
    fields: TypeORMVectorStoreArgs
  ): Promise<TypeORMVectorStore> {
    const postgresqlVectorStore = new TypeORMVectorStore(embeddings, fields);

    if (!postgresqlVectorStore.appDataSource.isInitialized) {
      await postgresqlVectorStore.appDataSource.initialize();
    }

    postgresqlVectorStore._verbose =
      typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.LANGCHAIN_VERBOSE !== undefined
        : fields?.verbose ?? false;

    return postgresqlVectorStore;
  }

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

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const { createHash } = await import("node:crypto");
    const rows = vectors.map((embedding, idx) => {
      const embeddingString = `[${embedding.join(",")}]`;
      const hash = createHash("sha1");
      const documentRow = {
        pageContent: documents[idx].pageContent,
        embedding: embeddingString,
        metadata: documents[idx].metadata,
        id: documents[idx].id ?? getUniqueIDFromDocument(documents[idx]),
        sourceType: getSourceTypeFromDocument(documents[idx]),
        sourceName: getSourceNameFromDocument(documents[idx]),
        hash:
          documents[idx].hash ??
          hash.update(documents[idx].pageContent).digest("hex"),
      };

      return documentRow;
    });

    const documentRepository = this.appDataSource.getRepository(
      this.documentEntity
    );

    // For a given document, we delete all documents in the database that have not the same id as
    // the ones we are trying to upsert because it means that the split of the file is not the same anymore
    for (const doc of rows) {
      if (!doc.sourceName || !doc.sourceType) {
        continue;
      }
      // Search for existing document with sourceName and type
      const documentsInDatabase = await documentRepository.find({
        where: {
          sourceName: doc.sourceName,
          sourceType: doc.sourceType,
        },
      });

      const documentsThatWillBeUpserted = rows.filter(
        (d) => d.sourceName === doc.sourceName
      );
      const idsDocumentsThatWillBeUpserted = documentsThatWillBeUpserted.map(
        (d) => d.id
      );

      const idsDocumentsThatWeShouldDeleted = documentsInDatabase
        .filter((d) => !idsDocumentsThatWillBeUpserted.includes(d.id))
        .map((d) => d.id);

      this.verboseConsoleLog(
        `Ids has changed for document ${doc.sourceName} and ${doc.sourceType}, action: delete this ids: ${idsDocumentsThatWeShouldDeleted}`
      );

      await documentRepository.delete({
        id: {
          in: idsDocumentsThatWeShouldDeleted,
        },
      });
    }

    const documentsToUpsert = [];
    for (const row of rows) {
      // Search for existing document with same sourceName and sourcetype
      const documentsInDatabase = (await documentRepository.findOne({
        where: {
          id: row.id,
        },
      })) as Document;

      if (documentsInDatabase) {
        if (documentsInDatabase.hash === row.hash) {
          this.verboseConsoleLog(
            `Same hash was found for id ${row.id}, action: ignore`
          );
        } else {
          documentsToUpsert.push(row);
          this.verboseConsoleLog(
            `Different hash was found for id ${row.id}, action: update embedding`
          );
        }
      } else {
        documentsToUpsert.push(row);
        this.verboseConsoleLog(
          `No document was found for id ${row.id}, action: create`
        );
      }
    }

    const chunkSize = 500;
    for (let i = 0; i < documentsToUpsert.length; i += chunkSize) {
      const chunk = documentsToUpsert.slice(i, i + chunkSize);

      try {
        await documentRepository.upsert(chunk, [`id`]);
      } catch (e) {
        console.error(e);
        throw new Error(`Error inserting: ${chunk[0].pageContent}`);
      }
    }
  }

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

  async ensureTableInDatabase(): Promise<void> {
    await this.appDataSource.query("CREATE EXTENSION IF NOT EXISTS vector;");
    await this.appDataSource.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id text PRIMARY KEY,
        "pageContent" text,
        metadata jsonb,
        "sourceType" text,
        "sourceName" text,
        hash text,
        embedding vector
      );
    `);
  }

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

  private verboseConsoleLog(message: string): void {
    if (this._verbose) {
      console.log(message);
    }
  }
}
