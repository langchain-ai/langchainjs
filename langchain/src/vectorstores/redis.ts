import { VectorStore } from "./base.js";
import { Document } from "../document.js";
import { Embeddings } from "embeddings/base.js";
import { RediSearchSchema, RedisClientType, SchemaFieldTypes, SearchOptions, VectorAlgorithms } from "redis";

export type RedisVectorStoreConfig = {
  redisClient: RedisClientType;
  indexName: string;
  keyPrefix?: string;
  contentKey?: string;
  metadataKey?: string;
  vectorKey?: string;
  filter?: RedisVectorStoreFilterType;
};

export type RedisVectorStoreFilterType = string[];

export class RedisVectorStore extends VectorStore {
  declare FilterType: RedisVectorStoreFilterType;

  redisClient: RedisClientType;
  indexName: string;
  keyPrefix: string;
  contentKey: string;
  metadataKey: string;
  vectorKey: string;

  filter?: RedisVectorStoreFilterType;

  constructor(embeddings: Embeddings, _dbConfig: RedisVectorStoreConfig) {
    super(embeddings, _dbConfig);

    this.redisClient = _dbConfig.redisClient;
    this.indexName = _dbConfig.indexName;
    this.keyPrefix = _dbConfig.keyPrefix ?? `doc:${this.indexName}:`;
    this.contentKey = _dbConfig.contentKey ?? 'content';
    this.metadataKey = _dbConfig.metadataKey ?? 'metadata';
    this.vectorKey = _dbConfig.vectorKey ?? 'content_vector';
    this.filter = _dbConfig.filter;
  }

  async addDocuments(documents: Document[], keys?: string[], batchSize?: number): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      keys,
      batchSize
    );
  }

  async addVectors(
    vectors: number[][],
    documents: Document[],
    keys: string[] = [],
    batchSize: number = 1000
  ): Promise<void> {
    // check if the index exists and create it if it doesn't
    await this.createIndex(vectors[0].length);

    const multi = this.redisClient.multi();

    vectors.map(async (vector, idx) => {
      const key = keys && keys.length ? keys[idx] : `${this.keyPrefix}${idx}`;
      const metadata = documents[idx] && documents[idx].metadata ? documents[idx].metadata : {};

      multi.hSet(key, {
        [this.vectorKey]: this.getFloat32Buffer(vector),
        [this.contentKey]: documents[idx].pageContent,
        [this.metadataKey]: this.escapeSpecialChars(JSON.stringify(metadata)),
      });

      // write batch
      if (idx % batchSize === 0) {
        await multi.exec();
      }
    });

    // cleanup final batch
    await multi.exec();
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: RedisVectorStoreFilterType
  ): Promise<[Document<Record<string, any>>, number][]> {
    if (filter && this.filter) {
      throw new Error('cannot provide both `filter` and `this.filter`');
    }

    const _filter = filter ?? this.filter;
    const results = await this.redisClient.ft.search(this.indexName, ...this.buildQuery(query, k, _filter));
    const result: [Document, number][] = [];

    if (results.total) {
      for (const res of results.documents) {
        if (res.value) {
          const document = res.value;
          if (document.vector_score) {
            result.push([
              new Document({
                pageContent: document[this.contentKey] as string,
                metadata: JSON.parse(this.unEscapeSpecialChars(document.metadata as string)),
              }),
              Number(document.vector_score),
            ])
          }
        }
      }
    }

    return result;
  }

  static fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: RedisVectorStoreConfig
  ): Promise<RedisVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return RedisVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: RedisVectorStoreConfig
  ): Promise<RedisVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  async checkIndexExists() {
    try {
      await this.redisClient.ft.info(this.indexName);
    } catch (err) {
      // index doesn't exist
      return false;
    }

    return true;
  }

  async createIndex(dimensions: number = 1536): Promise<void> {
    if (await this.checkIndexExists()) {
      return;
    }

    const schema: RediSearchSchema = {
      [this.vectorKey]: {
        type: SchemaFieldTypes.VECTOR,
        ALGORITHM: VectorAlgorithms.FLAT,
        TYPE: 'FLOAT32',
        DIM: dimensions,
        DISTANCE_METRIC: 'L2',
      },
      [this.contentKey]: SchemaFieldTypes.TEXT,
      [this.metadataKey]: SchemaFieldTypes.TEXT,
    };

    await this.redisClient.ft.create(this.indexName, schema, { ON: 'HASH', PREFIX: this.keyPrefix });
  }

  async dropIndex(): Promise<Boolean> {
    try {
      await this.redisClient.ft.dropIndex(this.indexName);

      return true;
    } catch (err) {
      return false;
    }
  }

  private buildQuery(query: number[], k: number, filter?: RedisVectorStoreFilterType): [string, SearchOptions] {
    const vectorScoreField = 'vector_score';

    let hybridFields: string = '*';
    // if a filter is set, modify the hybrid query
    if (filter && filter.length) {
      // `filter` is a list of strings, then it's applied using the OR operator in the metadata key
      // for example: filter = ['foo', 'bar'] => this will filter all metadata containing either 'foo' OR 'bar'
      hybridFields = `@${this.metadataKey}:(${this.prepareFilter(filter)})`;
    }

    const baseQuery = `${hybridFields} => [KNN ${k} @${this.vectorKey} $vector AS ${vectorScoreField}]`;
    const returnFields = [this.metadataKey, this.contentKey, vectorScoreField];

    const options: SearchOptions = {
      PARAMS: {
        vector: this.getFloat32Buffer(query),
      },
      RETURN: returnFields,
      SORTBY: vectorScoreField,
      DIALECT: 2,
      LIMIT: {
        from: 0,
        size: k,
      }
    };

    return [baseQuery, options];
  }

  private prepareFilter(filter: RedisVectorStoreFilterType) {
    return filter.map(this.escapeSpecialChars).join('|');
  }

  /**
   * Escapes all '-' characters.
   * RediSearch considers '-' as a negative operator, hence we need
   * to escape it
   * @see https://redis.io/docs/stack/search/reference/query_syntax
   *
   * @param str
   * @returns
   */
  private escapeSpecialChars(str: string) {
    return str.replaceAll('-', '\\-');
  }

  /**
   * Unescapes all '-' characters, returning the original string
   *
   * @param str
   * @returns
   */
  private unEscapeSpecialChars(str: string) {
    return str.replaceAll('\\-', '-');
  }

  /**
   * Converts the vector to the buffer Redis needs to
   * correctly store an embedding
   *
   * @param vector
   * @returns Buffer
   */
  private getFloat32Buffer(vector: number[]) {
    return Buffer.from(new Float32Array(vector).buffer);
  }
}
