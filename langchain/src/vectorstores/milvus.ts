import * as uuid from "uuid";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import {
  DataType,
  DataTypeMap,
} from "@zilliz/milvus2-sdk-node/dist/milvus/const/Milvus.js";
import {
  ErrorCode,
  FieldType,
} from "@zilliz/milvus2-sdk-node/dist/milvus/types.js";

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";

export interface MilvusLibArgs {
  collectionName?: string;
  primaryField?: string;
  vectorField?: string;
  textField?: string;
  url?: string; // db address
  ssl?: boolean;
  username?: string;
  password?: string;
}

type IndexType =
  | "IVF_FLAT"
  | "IVF_SQ8"
  | "IVF_PQ"
  | "HNSW"
  | "RHNSW_FLAT"
  | "RHNSW_SQ"
  | "RHNSW_PQ"
  | "IVF_HNSW"
  | "ANNOY";

interface IndexParam {
  params: { nprobe?: number; ef?: number; search_k?: number };
}

interface InsertRow {
  [x: string]: string | number[];
}

const MILVUS_PRIMARY_FIELD_NAME = "langchain_primaryid";
const MILVUS_VECTOR_FIELD_NAME = "langchain_vector";
const MILVUS_TEXT_FIELD_NAME = "langchain_text";
const MILVUS_COLLECTION_NAME_PREFIX = "langchain_col";

export class Milvus extends VectorStore {
  collectionName: string;

  numDimensions?: number;

  autoId?: boolean;

  primaryField: string;

  vectorField: string;

  textField: string;

  fields: string[];

  client: MilvusClient;

  colMgr: MilvusClient["collectionManager"];

  idxMgr: MilvusClient["indexManager"];

  dataMgr: MilvusClient["dataManager"];

  indexParams: Record<IndexType, IndexParam> = {
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

  indexCreateParams = {
    index_type: "HNSW",
    metric_type: "L2",
    params: JSON.stringify({ M: 8, efConstruction: 64 }),
  };

  indexSearchParams = JSON.stringify({ ef: 64 });

  constructor(embeddings: Embeddings, args: MilvusLibArgs) {
    super(embeddings, args);
    this.embeddings = embeddings;
    this.collectionName = args.collectionName ?? genCollectionName();
    this.textField = args.textField ?? MILVUS_TEXT_FIELD_NAME;

    this.autoId = true;
    this.primaryField = args.primaryField ?? MILVUS_PRIMARY_FIELD_NAME;
    this.vectorField = args.vectorField ?? MILVUS_VECTOR_FIELD_NAME;
    this.fields = [];

    const url =
      args.url ??
      // eslint-disable-next-line no-process-env
      (typeof process !== "undefined" ? process.env?.MILVUS_URL : undefined);
    if (!url) {
      throw new Error("Milvus URL address is not provided.");
    }
    this.client = new MilvusClient(url, args.ssl, args.username, args.password);
    this.colMgr = this.client.collectionManager;
    this.idxMgr = this.client.indexManager;
    this.dataMgr = this.client.dataManager;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }
    await this.ensureCollection(vectors, documents);

    const insertDatas: InsertRow[] = [];
    // eslint-disable-next-line no-plusplus
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
            if (!this.autoId) {
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

    const insertResp = await this.dataMgr.insert({
      collection_name: this.collectionName,
      fields_data: insertDatas,
    });
    if (insertResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error inserting data: ${JSON.stringify(insertResp)}`);
    }
    await this.dataMgr.flushSync({ collection_names: [this.collectionName] });
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    const hasColResp = await this.colMgr.hasCollection({
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

    await this.grabCollectionFields();

    const loadResp = await this.colMgr.loadCollectionSync({
      collection_name: this.collectionName,
    });
    if (loadResp.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error loading collection: ${loadResp}`);
    }

    // clone this.field and remove vectorField
    const outputFields = this.fields.filter(
      (field) => field !== this.vectorField
    );

    const searchResp = await this.dataMgr.search({
      collection_name: this.collectionName,
      search_params: {
        anns_field: this.vectorField,
        topk: k.toString(),
        metric_type: this.indexCreateParams.metric_type,
        params: this.indexSearchParams,
      },
      output_fields: outputFields,
      vector_type: DataType.FloatVector,
      vectors: [query],
    });
    if (searchResp.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(`Error searching data: ${JSON.stringify(searchResp)}`);
    }
    const results: [Document, number][] = [];
    searchResp.results.forEach((result) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = { pageContent: "", metadata: {} as Record<string, any> };
      Object.keys(result).forEach((key) => {
        if (key === this.textField) {
          fields.pageContent = result[key];
        } else if (this.fields.includes(key)) {
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

  async ensureCollection(vectors?: number[][], documents?: Document[]) {
    const hasColResp = await this.colMgr.hasCollection({
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

  async createCollection(
    vectors: number[][],
    documents: Document[]
  ): Promise<void> {
    const fieldList: FieldType[] = [];

    fieldList.push(...createFieldTypeForMetadata(documents));

    fieldList.push(
      {
        name: this.primaryField,
        description: "Primary key",
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: this.autoId,
      },
      {
        name: this.textField,
        description: "Text field",
        data_type: DataType.VarChar,
        type_params: {
          max_length: getTextFieldMaxLength(documents).toString(),
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

    fieldList.forEach((field) => {
      if (!field.autoID) {
        this.fields.push(field.name);
      }
    });

    const createRes = await this.colMgr.createCollection({
      collection_name: this.collectionName,
      fields: fieldList,
    });

    if (createRes.error_code !== ErrorCode.SUCCESS) {
      console.log(createRes);
      throw new Error(`Failed to create collection: ${createRes}`);
    }

    await this.idxMgr.createIndex({
      collection_name: this.collectionName,
      field_name: this.vectorField,
      extra_params: this.indexCreateParams,
    });
  }

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
    const desc = await this.colMgr.describeCollection({
      collection_name: this.collectionName,
    });
    desc.schema.fields.forEach((field) => {
      this.fields.push(field.name);
      if (field.autoID) {
        const index = this.fields.indexOf(field.name);
        if (index !== -1) {
          this.fields.splice(index, 1);
        }
      }
      if (field.is_primary_key) {
        this.primaryField = field.name;
      }
      const dtype = DataTypeMap[field.data_type.toLowerCase()];
      if (dtype === DataType.FloatVector || dtype === DataType.BinaryVector) {
        this.vectorField = field.name;
      }

      if (dtype === DataType.VarChar && field.name === MILVUS_TEXT_FIELD_NAME) {
        this.textField = field.name;
      }
    });
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig?: {
      collectionName?: string;
      url?: string;
    }
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

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig?: MilvusLibArgs
  ): Promise<Milvus> {
    const args: MilvusLibArgs = {
      collectionName: dbConfig?.collectionName || genCollectionName(),
      url: dbConfig?.url,
    };
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingCollection(
    embeddings: Embeddings,
    dbConfig: MilvusLibArgs
  ): Promise<Milvus> {
    const instance = new this(embeddings, dbConfig);
    await instance.ensureCollection();
    return instance;
  }
}

function createFieldTypeForMetadata(documents: Document[]): FieldType[] {
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
    if (type === "string") {
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
      } catch (e) {
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
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < documents.length; i++) {
    const text = documents[i].pageContent;
    if (text.length > textMaxLength) {
      textMaxLength = text.length;
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
  } catch (e) {
    return { isJson: false, obj: null };
  }
}
