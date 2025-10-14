import * as uuid from "uuid";
import {
  MilvusClient,
  DataType,
  DataTypeMap,
  ErrorCode,
  FieldType,
  ClientConfig,
  InsertReq,
  keyValueObj,
} from "@zilliz/milvus2-sdk-node";

import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface for the arguments required by the Milvus class constructor.
 */
export interface MilvusLibArgs {
  collectionName?: string;
  partitionName?: string;
  primaryField?: string;
  vectorField?: string;
  textField?: string;
  url?: string; // db address
  ssl?: boolean;
  username?: string;
  password?: string;
  textFieldMaxLength?: number;
  clientConfig?: ClientConfig;
  autoId?: boolean;
  indexCreateOptions?: IndexCreateOptions;
  partitionKey?: string; // doc: https://milvus.io/docs/use-partition-key.md
  partitionKeyMaxLength?: number;
}

export interface IndexCreateOptions {
  index_type: IndexType;
  metric_type: MetricType;
  params?: keyValueObj;
  // index search params
  search_params?: keyValueObj;
}

export type MetricType = "L2" | "IP" | "COSINE";

/**
 * Type representing the type of index used in the Milvus database.
 */
type IndexType =
  | "FLAT"
  | "IVF_FLAT"
  | "IVF_SQ8"
  | "IVF_PQ"
  | "HNSW"
  | "RHNSW_FLAT"
  | "RHNSW_SQ"
  | "RHNSW_PQ"
  | "IVF_HNSW"
  | "ANNOY";

/**
 * Interface for vector search parameters.
 */
interface IndexSearchParam {
  params: { nprobe?: number; ef?: number; search_k?: number };
}

interface InsertRow {
  [x: string]: string | number[];
}

const MILVUS_PRIMARY_FIELD_NAME = "langchain_primaryid";
const MILVUS_VECTOR_FIELD_NAME = "langchain_vector";
const MILVUS_TEXT_FIELD_NAME = "langchain_text";
const MILVUS_COLLECTION_NAME_PREFIX = "langchain_col";
const MILVUS_PARTITION_KEY_MAX_LENGTH = 512;

/**
 * Default parameters for index searching.
 */
const DEFAULT_INDEX_SEARCH_PARAMS: Record<IndexType, IndexSearchParam> = {
  FLAT: { params: {} },
  IVF_FLAT: { params: { nprobe: 10 } },
  IVF_SQ8: { params: { nprobe: 10 } },
  IVF_PQ: { params: { nprobe: 10 } },
  HNSW: { params: { ef: 10 } },
  RHNSW_FLAT: { params: { ef: 10 } },
  RHNSW_SQ: { params: { ef: 10 } },
  RHNSW_PQ: { params: { ef: 10 } },
  IVF_HNSW: { params: { nprobe: 10, ef: 10 } },
  ANNOY: { params: { search_k: 10 } },
};

/**
 * Class for interacting with a Milvus database. Extends the VectorStore
 * class.
 */
export class Milvus extends VectorStore {
  get lc_secrets(): { [key: string]: string } {
    return {
      ssl: "MILVUS_SSL",
      username: "MILVUS_USERNAME",
      password: "MILVUS_PASSWORD",
    };
  }

  _vectorstoreType(): string {
    return "milvus";
  }

  declare FilterType: string;

  collectionName: string;

  partitionName?: string;

  numDimensions?: number;

  autoId?: boolean;

  primaryField: string;

  vectorField: string;

  textField: string;

  textFieldMaxLength: number;

  partitionKey?: string;

  partitionKeyMaxLength?: number;

  fields: string[];

  client: MilvusClient;

  indexCreateParams: IndexCreateOptions;

  indexSearchParams: keyValueObj;

  constructor(public embeddings: EmbeddingsInterface, args: MilvusLibArgs) {
    super(embeddings, args);
    this.collectionName = args.collectionName ?? genCollectionName();
    this.partitionName = args.partitionName;
    this.textField = args.textField ?? MILVUS_TEXT_FIELD_NAME;

    this.autoId = args.autoId ?? true;
    this.primaryField = args.primaryField ?? MILVUS_PRIMARY_FIELD_NAME;
    this.vectorField = args.vectorField ?? MILVUS_VECTOR_FIELD_NAME;

    this.textFieldMaxLength = args.textFieldMaxLength ?? 0;

    this.partitionKey = args.partitionKey;
    this.partitionKeyMaxLength =
      args.partitionKeyMaxLength ?? MILVUS_PARTITION_KEY_MAX_LENGTH;

    this.fields = [];

    const url = args.url ?? getEnvironmentVariable("MILVUS_URL");
    const {
      address = "",
      username = "",
      password = "",
      ssl,
    } = args.clientConfig || {};

    // Index creation parameters
    const { indexCreateOptions } = args;
    if (indexCreateOptions) {
      const {
        metric_type,
        index_type,
        params,
        search_params = {},
      } = indexCreateOptions;
      this.indexCreateParams = {
        metric_type,
        index_type,
        params,
      };
      this.indexSearchParams = {
        ...DEFAULT_INDEX_SEARCH_PARAMS[index_type].params,
        ...search_params,
      };
    } else {
      // Default index creation parameters.
      this.indexCreateParams = {
        index_type: "HNSW",
        metric_type: "L2",
        params: { M: 8, efConstruction: 64 },
      };
      // Default index search parameters.
      this.indexSearchParams = {
        ...DEFAULT_INDEX_SEARCH_PARAMS.HNSW.params,
      };
    }

    // combine args clientConfig and env variables
    const clientConfig: ClientConfig = {
      ...(args.clientConfig || {}),
      address: url || address,
      username: args.username || username,
      password: args.password || password,
      ssl: args.ssl || ssl,
    };

    if (!clientConfig.address) {
      throw new Error("Milvus URL address is not provided.");
    }
    this.client = new MilvusClient(clientConfig);
  }

  /**
   * Adds documents to the Milvus database.
   * @param documents Array of Document instances to be added to the database.
   * @param options Optional parameter that can include specific IDs for the documents.
   * @returns Promise resolving to void.
   */
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Adds vectors to the Milvus database.
   * @param vectors Array of vectors to be added to the database.
   * @param documents Array of Document instances associated with the vectors.
   * @param options Optional parameter that can include specific IDs for the documents.
   * @returns Promise resolving to void.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<void> {
    if (vectors.length === 0) {
      return;
    }
    await this.ensureCollection(vectors, documents);
    if (this.partitionName !== undefined) {
      await this.ensurePartition();
    }

    const documentIds = options?.ids ?? [];

    const insertDatas: InsertRow[] = [];
    for (let index = 0; index < vectors.length; index++) {
      const vec = vectors[index];
      const doc = documents[index];
      const data: InsertRow = {
        [this.textField]: doc.pageContent,
        [this.vectorField]: vec,
      };
      this.fields.forEach((field) => {
        switch (field) {
          case this.primaryField:
            if (documentIds[index] !== undefined) {
              data[field] = documentIds[index];
            } else if (!this.autoId) {
              if (doc.metadata[this.primaryField] === undefined) {
                throw new Error(
                  `The Collection's primaryField is configured with autoId=false, thus its value must be provided through metadata.`
                );
              }
              data[field] = doc.metadata[this.primaryField];
            }
            break;
          case this.textField:
            data[field] = doc.pageContent;
            break;
          case this.vectorField:
            data[field] = vec;
            break;
          default: // metadata fields
            if (doc.metadata[field] === undefined) {
              throw new Error(
                `The field "${field}" is not provided in documents[${index}].metadata.`
              );
            } else if (typeof doc.metadata[field] === "object") {
              data[field] = JSON.stringify(doc.metadata[field]);
            } else {
              data[field] = doc.metadata[field];
            }
            break;
        }
      });

      insertDatas.push(data);
    }

    const params: InsertReq = {
      collection_name: this.collectionName,
      fields_data: insertDatas,
    };
    if (this.partitionName !== undefined) {
      params.partition_name = this.partitionName;
    }
    const insertResp = this.autoId
      ? await this.client.insert(params)
      : await this.client.upsert(params);

    if (insertResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(
        `Error ${
          this.autoId ? "inserting" : "upserting"
        } data: ${JSON.stringify(insertResp)}`
      );
    }
    await this.client.flushSync({ collection_names: [this.collectionName] });
  }

  /**
   * Searches for vectors in the Milvus database that are similar to a given
   * vector.
   * @param query Vector to compare with the vectors in the database.
   * @param k Number of similar vectors to return.
   * @param filter Optional filter to apply to the search.
   * @returns Promise resolving to an array of tuples, each containing a Document instance and a similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: string
  ): Promise<[Document, number][]> {
    const hasColResp = await this.client.hasCollection({
      collection_name: this.collectionName,
    });
    if (hasColResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error checking collection: ${hasColResp}`);
    }
    if (hasColResp.value === false) {
      throw new Error(
        `Collection not found: ${this.collectionName}, please create collection before search.`
      );
    }

    const filterStr = filter ?? "";

    await this.grabCollectionFields();

    const loadResp = await this.client.loadCollectionSync({
      collection_name: this.collectionName,
    });
    if (loadResp.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error loading collection: ${loadResp}`);
    }

    // clone this.field and remove vectorField
    const outputFields = this.fields.filter(
      (field) => field !== this.vectorField
    );

    const searchResp = await this.client.search({
      collection_name: this.collectionName,
      search_params: {
        anns_field: this.vectorField,
        topk: k,
        metric_type: this.indexCreateParams.metric_type,
        params: JSON.stringify(this.indexSearchParams),
      },
      output_fields: outputFields,
      vector_type: DataType.FloatVector,
      vectors: [query],
      filter: filterStr,
    });
    if (searchResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error searching data: ${JSON.stringify(searchResp)}`);
    }
    const results: [Document, number][] = [];
    searchResp.results.forEach((result) => {
      const fields = {
        pageContent: "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: {} as Record<string, any>,
      };
      Object.keys(result).forEach((key) => {
        if (key === this.textField) {
          fields.pageContent = result[key];
        } else if (this.fields.includes(key) || key === this.primaryField) {
          if (typeof result[key] === "string") {
            const { isJson, obj } = checkJsonString(result[key]);
            fields.metadata[key] = isJson ? obj : result[key];
          } else {
            fields.metadata[key] = result[key];
          }
        }
      });
      results.push([new Document(fields), result.score]);
    });
    // console.log("Search result: " + JSON.stringify(results, null, 2));
    return results;
  }

  /**
   * Ensures that a collection exists in the Milvus database.
   * @param vectors Optional array of vectors to be used if a new collection needs to be created.
   * @param documents Optional array of Document instances to be used if a new collection needs to be created.
   * @returns Promise resolving to void.
   */
  async ensureCollection(vectors?: number[][], documents?: Document[]) {
    const hasColResp = await this.client.hasCollection({
      collection_name: this.collectionName,
    });
    if (hasColResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(
        `Error checking collection: ${JSON.stringify(hasColResp, null, 2)}`
      );
    }

    if (hasColResp.value === false) {
      if (vectors === undefined || documents === undefined) {
        throw new Error(
          `Collection not found: ${this.collectionName}, please provide vectors and documents to create collection.`
        );
      }
      await this.createCollection(vectors, documents);
    } else {
      await this.grabCollectionFields();
    }
  }

  /**
   * Ensures that a partition exists in the Milvus collection.
   * @returns Promise resolving to void.
   */
  async ensurePartition() {
    if (this.partitionName === undefined) {
      return;
    }
    const hasPartResp = await this.client.hasPartition({
      collection_name: this.collectionName,
      partition_name: this.partitionName,
    });
    if (hasPartResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(
        `Error checking partition: ${JSON.stringify(hasPartResp, null, 2)}`
      );
    }

    if (hasPartResp.value === false) {
      await this.client.createPartition({
        collection_name: this.collectionName,
        partition_name: this.partitionName,
      });
    }
  }

  /**
   * Creates a collection in the Milvus database.
   * @param vectors Array of vectors to be added to the new collection.
   * @param documents Array of Document instances to be added to the new collection.
   * @returns Promise resolving to void.
   */
  async createCollection(
    vectors: number[][],
    documents: Document[]
  ): Promise<void> {
    const fieldList: FieldType[] = [];

    fieldList.push(
      ...createFieldTypeForMetadata(
        documents,
        this.primaryField,
        this.partitionKey
      )
    );

    if (this.autoId) {
      fieldList.push({
        name: this.primaryField,
        description: "Primary key",
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      });
    } else {
      fieldList.push({
        name: this.primaryField,
        description: "Primary key",
        data_type: DataType.VarChar,
        is_primary_key: true,
        autoID: false,
        max_length: 65535,
      });
    }

    fieldList.push(
      {
        name: this.textField,
        description: "Text field",
        data_type: DataType.VarChar,
        type_params: {
          max_length:
            this.textFieldMaxLength > 0
              ? this.textFieldMaxLength.toString()
              : getTextFieldMaxLength(documents).toString(),
        },
      },
      {
        name: this.vectorField,
        description: "Vector field",
        data_type: DataType.FloatVector,
        type_params: {
          dim: getVectorFieldDim(vectors).toString(),
        },
      }
    );

    if (this.partitionKey) {
      fieldList.push({
        name: this.partitionKey,
        description: "Partition key",
        data_type: DataType.VarChar,
        max_length: this.partitionKeyMaxLength,
        is_partition_key: true,
      });
    }

    fieldList.forEach((field) => {
      if (!field.autoID) {
        this.fields.push(field.name);
      }
    });

    const createRes = await this.client.createCollection({
      collection_name: this.collectionName,
      fields: fieldList,
    });

    if (createRes.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Failed to create collection: ${createRes}`);
    }

    const extraParams = {
      ...this.indexCreateParams,
      params: JSON.stringify(this.indexCreateParams.params),
    };
    await this.client.createIndex({
      collection_name: this.collectionName,
      field_name: this.vectorField,
      extra_params: extraParams,
    });
  }

  /**
   * Retrieves the fields of a collection in the Milvus database.
   * @returns Promise resolving to void.
   */
  async grabCollectionFields(): Promise<void> {
    if (!this.collectionName) {
      throw new Error("Need collection name to grab collection fields");
    }
    if (
      this.primaryField &&
      this.vectorField &&
      this.textField &&
      this.fields.length > 0
    ) {
      return;
    }
    const desc = await this.client.describeCollection({
      collection_name: this.collectionName,
    });
    desc.schema.fields.forEach((field) => {
      this.fields.push(field.name);
      // Only remove autoID fields from this.fields if we're using autoId mode
      // When autoId is false, we need to include the primary field for upsert operations
      if (field.autoID && this.autoId) {
        const index = this.fields.indexOf(field.name);
        if (index !== -1) {
          this.fields.splice(index, 1);
        }
      }
      if (field.is_primary_key) {
        this.primaryField = field.name;
      }
      const dtype = DataTypeMap[field.data_type];
      if (dtype === DataType.FloatVector || dtype === DataType.BinaryVector) {
        this.vectorField = field.name;
      }

      if (dtype === DataType.VarChar && field.name === MILVUS_TEXT_FIELD_NAME) {
        this.textField = field.name;
      }
    });
  }

  /**
   * Creates a Milvus instance from a set of texts and their associated
   * metadata.
   * @param texts Array of texts to be added to the database.
   * @param metadatas Array of metadata objects associated with the texts.
   * @param embeddings Embeddings instance used to generate vector embeddings for the texts.
   * @param dbConfig Optional configuration for the Milvus database.
   * @returns Promise resolving to a new Milvus instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig?: MilvusLibArgs
  ): Promise<Milvus> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return Milvus.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Creates a Milvus instance from a set of Document instances.
   * @param docs Array of Document instances to be added to the database.
   * @param embeddings Embeddings instance used to generate vector embeddings for the documents.
   * @param dbConfig Optional configuration for the Milvus database.
   * @returns Promise resolving to a new Milvus instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig?: MilvusLibArgs
  ): Promise<Milvus> {
    const args: MilvusLibArgs = {
      ...dbConfig,
      collectionName: dbConfig?.collectionName ?? genCollectionName(),
    };
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Creates a Milvus instance from an existing collection in the Milvus
   * database.
   * @param embeddings Embeddings instance used to generate vector embeddings for the documents in the collection.
   * @param dbConfig Configuration for the Milvus database.
   * @returns Promise resolving to a new Milvus instance.
   */
  static async fromExistingCollection(
    embeddings: EmbeddingsInterface,
    dbConfig: MilvusLibArgs
  ): Promise<Milvus> {
    const instance = new this(embeddings, dbConfig);
    await instance.ensureCollection();
    return instance;
  }

  /**
   * Deletes data from the Milvus database.
   * @param params Object containing a filter to apply to the deletion.
   * @returns Promise resolving to void.
   */
  async delete(params: { filter?: string; ids?: string[] }): Promise<void> {
    const hasColResp = await this.client.hasCollection({
      collection_name: this.collectionName,
    });
    if (hasColResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error checking collection: ${hasColResp}`);
    }
    if (hasColResp.value === false) {
      throw new Error(
        `Collection not found: ${this.collectionName}, please create collection before search.`
      );
    }

    const { filter, ids } = params;

    if (filter && !ids) {
      const deleteResp = await this.client.deleteEntities({
        collection_name: this.collectionName,
        expr: filter,
      });

      if (deleteResp.status.error_code !== ErrorCode.SUCCESS) {
        throw new Error(`Error deleting data: ${JSON.stringify(deleteResp)}`);
      }
    } else if (!filter && ids && ids.length > 0) {
      const deleteResp = await this.client.delete({
        collection_name: this.collectionName,
        ids,
      });

      if (deleteResp.status.error_code !== ErrorCode.SUCCESS) {
        throw new Error(
          `Error deleting data with ids: ${JSON.stringify(deleteResp)}`
        );
      }
    }
  }
}

function createFieldTypeForMetadata(
  documents: Document[],
  primaryFieldName: string,
  partitionKey?: string
): FieldType[] {
  const sampleMetadata = documents[0].metadata;
  let textFieldMaxLength = 0;
  let jsonFieldMaxLength = 0;
  documents.forEach(({ metadata }) => {
    // check all keys name and count in metadata is same as sampleMetadata
    Object.keys(metadata).forEach((key) => {
      if (
        !(key in metadata) ||
        typeof metadata[key] !== typeof sampleMetadata[key]
      ) {
        throw new Error(
          "All documents must have same metadata keys and datatype"
        );
      }

      // find max length of string field and json field, cache json string value
      if (typeof metadata[key] === "string") {
        if (metadata[key].length > textFieldMaxLength) {
          textFieldMaxLength = metadata[key].length;
        }
      } else if (typeof metadata[key] === "object") {
        const json = JSON.stringify(metadata[key]);
        if (json.length > jsonFieldMaxLength) {
          jsonFieldMaxLength = json.length;
        }
      }
    });
  });

  const fields: FieldType[] = [];
  for (const [key, value] of Object.entries(sampleMetadata)) {
    const type = typeof value;

    if (key === primaryFieldName || key === partitionKey) {
      /**
       * skip primary field and partition key
       * because we will create primary field and partition key in createCollection
       *  */
    } else if (type === "string") {
      fields.push({
        name: key,
        description: `Metadata String field`,
        data_type: DataType.VarChar,
        type_params: {
          max_length: textFieldMaxLength.toString(),
        },
      });
    } else if (type === "number") {
      fields.push({
        name: key,
        description: `Metadata Number field`,
        data_type: DataType.Float,
      });
    } else if (type === "boolean") {
      fields.push({
        name: key,
        description: `Metadata Boolean field`,
        data_type: DataType.Bool,
      });
    } else if (value === null) {
      // skip
    } else {
      // use json for other types
      try {
        fields.push({
          name: key,
          description: `Metadata JSON field`,
          data_type: DataType.VarChar,
          type_params: {
            max_length: jsonFieldMaxLength.toString(),
          },
        });
      } catch {
        throw new Error("Failed to parse metadata field as JSON");
      }
    }
  }
  return fields;
}

function genCollectionName(): string {
  return `${MILVUS_COLLECTION_NAME_PREFIX}_${uuid.v4().replaceAll("-", "")}`;
}

function getTextFieldMaxLength(documents: Document[]) {
  let textMaxLength = 0;
  const textEncoder = new TextEncoder();
  for (let i = 0; i < documents.length; i++) {
    const text = documents[i].pageContent;
    const textLengthInBytes = textEncoder.encode(text).length;
    if (textLengthInBytes > textMaxLength) {
      textMaxLength = textLengthInBytes;
    }
  }
  return textMaxLength;
}

function getVectorFieldDim(vectors: number[][]) {
  if (vectors.length === 0) {
    throw new Error("No vectors found");
  }
  return vectors[0].length;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkJsonString(value: string): { isJson: boolean; obj: any } {
  try {
    const result = JSON.parse(value);
    return { isJson: true, obj: result };
  } catch {
    return { isJson: false, obj: null };
  }
}
