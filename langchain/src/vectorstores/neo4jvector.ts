import neo4j from "neo4j-driver";
import * as uuid from "uuid";
import { Document } from "../document.js";
import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";

interface Neo4jVectorStoreArgs {
  url: string;
  username: string;
  password: string;
  database?: string;
  preDeleteCollection?: boolean;
}

interface Neo4jVectorStoreMetadatas {}

export class Neo4jVectorStore extends VectorStore {
  private driver: neo4j.Driver;

  private database: string;

  private nodeLabel: string = "Chunk";

  private embeddingNodeProperty: string = "embedding";

  private textNodeProperty: string = "text";

  private indexName: string = "vector";

  private retrievalQuery: string = "";

  private preDeleteCollection: boolean = false;

  _vectorstoreType(): string {
    return "neo4jvector";
  }

  constructor(embedings: Embeddings, config: Neo4jVectorStoreArgs) {
    super(embedings, config);
  }

  async _initialize(embedings: Embeddings, config: Neo4jVectorStoreArgs) {
    const {} = config;

    const neo4jVectorStore = new Neo4jVectorStore(embedings, config);
    await neo4jVectorStore._initializeDriver(config);
    await neo4jVectorStore._verifyConnectivity();

    if (neo4jVectorStore.preDeleteCollection) {
      neo4jVectorStore._dropIndex();
    }

    return neo4jVectorStore;
  }

  async _initializeDriver({
    url,
    username,
    password,
    database = "neo4j",
  }: Neo4jVectorStoreArgs) {
    try {
      this.driver = neo4j.driver(url, neo4j.auth.basic(username, password));
      this.database = database;
    } catch (error) {
      throw new Error(
        "Could not create a Neo4j driver instance. Please check the connection details."
      );
    }
  }

  async _verifyConnectivity() {
    try {
      const session = this.driver.session({ database: this.database });
      await session.close();
    } catch (error: any) {
      console.log("Failed to verify connection.");
    }
  }

  async _dropIndex() {
    try {
      await this.query(`
            MATCH (n:${this.nodeLabel})
            CALL {
              WITH n
              DETACH DELETE n
            }
            IN TRANSACTIONS OF 10000 ROWS;
          `);
      await this.query(`DROP INDEX ${this.indexName}`);
    } catch (error) {
      console.error("An error occurred while dropping the index:", error);
    }
  }

  async query(query: string, params: any = {}): Promise<any[]> {
    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(query, params);
      return result.records.map((record) => record.toObject());
    } finally {
      await session.close();
    }
  }

  async fromTexts(
    texts: string[],
    metadatas: Neo4jVectorStoreMetadatas | null = null,
    embeddings: Embeddings,
    config: Neo4jVectorStoreArgs
  ): Promise<Neo4jVectorStore> {
    const neo4jVectorStore = await this._initialize(embeddings, config);
    neo4jVectorStore.embeddings.embedDocuments(texts);

    return neo4jVectorStore;
  }

  async addVectors(
    vectors: number[][],
    documents: Document[],
    metadatas?: Record<string, any>[],
    ids?: string[]
  ): Promise<string[]> {
    if (!ids) {
      ids = documents.map(() => uuid.v1());
    }

    if (!metadatas) {
      metadatas = documents.map(() => ({}));
    }

    const importQuery = `
      UNWIND $data AS row
      CALL {
        WITH row
        MERGE (c:${this.nodeLabel} {id: row.id})
        WITH c, row
        CALL db.create.setVectorProperty(c, '${this.embeddingNodeProperty}', row.embedding)
        YIELD node
        SET c.${this.textNodeProperty} = row.text
        SET c += row.metadata
      } IN TRANSACTIONS OF 1000 ROWS
    `;

    const parameters = {
      data: documents.map((text, index) => ({
        text,
        metadata: metadatas ? metadatas[index] : null,
        embedding: vectors ? vectors[index] : null,
        id: ids ? ids[index] : null,
      })),
    };

    await this.query(importQuery, parameters);

    return ids;
  }

  async addDocuments(documents: Document[]): Promise<string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);

    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async similaritySearchVectorWithScore(
    vector: number[],
    k: number = 4
  ): Promise<[Document, number][]> {
    const defaultRetrieval = `
      RETURN node.${this.textNodeProperty} AS text, score,
      node {.*, ${this.textNodeProperty}: Null,
      ${this.embeddingNodeProperty}: Null, id: Null } AS metadata
    `;

    const retrievalQuery = this.retrievalQuery
      ? this.retrievalQuery
      : defaultRetrieval;

    const readQuery = `
      CALL db.index.vector.queryNodes($index, $k, $embedding)
      YIELD node, score ${retrievalQuery}
    `;

    const parameters = { index: this.indexName, k, embedding: vector };

    const results = await this.query(readQuery, parameters);

    const docs: [Document, number][] = results.map((result: any) => [
      new Document({
        pageContent: result.text,
        metadata: Object.fromEntries(
          Object.entries(result.metadata).filter(([_, v]) => v !== null)
        ),
      }),
      result.score,
    ]);

    return docs;
  }
}
