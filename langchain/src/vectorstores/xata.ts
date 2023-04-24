/* eslint-disable no-use-before-define */
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export interface XataLibArgs {
  apiKey: string;
  workspaceSlug: string;
  region: string;
  db: string;
  dbBranchName?: string;
  tableName: string;
  textColumn: string;
  vectorColumn: string;
  otherColumns?: string[];
  filter?: XataFilterExpression;
}

/**
 * @minProperties 1
 */
export type XataFilterExpression = {
  $exists?: string;
  $existsNot?: string;
  $any?: FilterList;
  $all?: FilterList;
  $none?: FilterList;
  $not?: FilterList;
} & {
  [key: string]: FilterColumn;
};

/**
 * XataStore class for storing and searching text embeddings using Xata platform.
 * Extends the VectorStore class.
 */
export class XataStore extends VectorStore {
  apiKey: string;

  workspaceSlug: string;

  region: string;

  db: string;

  dbBranchName: string;

  tableName: string;

  textColumn: string;

  vectorColumn: string;

  otherColumns: string[];

  baseUrl: string;

  filter: XataFilterExpression | undefined;

  /**
   * Constructs a new XataStore instance.
   * @param {Embeddings} embeddings - The embeddings object for transforming documents into vector representations.
   * @param {XataLibArgs} args - Configuration options for the XataStore.
   */
  constructor(embeddings: Embeddings, args: XataLibArgs) {
    super(embeddings, args);

    this.apiKey = args.apiKey;
    this.embeddings = embeddings;
    this.workspaceSlug = args.workspaceSlug;
    this.region = args.region;
    this.db = args.db;
    this.dbBranchName = args.dbBranchName ?? "main";
    this.tableName = args.tableName;
    this.vectorColumn = args.vectorColumn;
    this.textColumn = args.textColumn;
    this.otherColumns = args.otherColumns ?? [];
    this.filter = args.filter;
    this.baseUrl = `https://${this.workspaceSlug}.${this.region}.xata.sh/db/${this.db}:${this.dbBranchName}/tables/${this.tableName}`;
  }

  /**
   * Adds documents to the store.
   * @param {Document[]} documents - An array of documents to add.
   * @return {Promise<void>}
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Adds vectors to the store.
   * @param {number[][]} vectors - An array of vector representations.
   * @param {Document[]} documents - An array of documents.
   * @param {string[] | undefined} ids - An array of document IDs (optional).
   * @return {Promise<void>}
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    ids?: string[]
  ): Promise<void> {
    const items = vectors.map((embedding, idx) => {
      const item = {
        [`${this.textColumn}`]: documents[idx].pageContent,
        [`${this.vectorColumn}`]: embedding,
      };

      if (ids) {
        item.id = ids[idx];
      }

      for (const col of this.otherColumns) {
        item[col] =
          col === "id"
            ? String(documents[idx].metadata[col])
            : documents[idx].metadata[col];
      }

      return item;
    });

    // Xata supports at most bulk insert of 50 items at a time
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      await this.bulkInsert(chunk);
    }
  }

  /**
   * Performs a similarity search on the vector with score.
   * @param {number[]} query - The query vector.
   * @param {number} k - The number of closest results to return.
   * @return {Promise<[Document, number][]>} - Returns a Promise that resolves to an array of tuples, where the first element is a Document and the second element is the similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    const payload: VectorSearchTable = {
      queryVector: query,
      size: k,
      column: this.vectorColumn,
      filter: this.filter,
    };

    const results = await this.vectorSearch(payload);
    return results.records.map((record) => {
      const doc: Document = {
        pageContent: record[this.textColumn],
        metadata: {},
      };

      for (const col of this.otherColumns) {
        doc.metadata ??= {};
        doc.metadata[col] = record[col];
      }

      return [new Document(doc), record.xata.score ?? 0];
    });
  }

  /**
   * @private
   * Bulk inserts data records into the Xata table.
   * @param {DataInputRecord[]} items - An array of data input records to insert.
   * @return {Promise<void>}
   */
  private bulkInsert = async (items: DataInputRecord[]) => {
    const payload: BulkInsertTableRecords = { records: items };

    const resp = await fetch(`${this.baseUrl}/bulk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      throw new Error(`Error inserting records: ${resp.statusText}`);
    }
  };

  /**
   * @private
   * Performs a vector search on the Xata table.
   * @param {VectorSearchTable} payload - The payload for the vector search.
   * @return {Promise<VectorSearchResults>} - Returns a Promise that resolves to vector search results.
   */
  private vectorSearch = async (
    payload: VectorSearchTable
  ): Promise<VectorSearchResults> => {
    const response = await fetch(`${this.baseUrl}/vectorSearch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error searching for vectors: ${response.statusText}`);
    }

    return await response.json();
  };

  /**
   * Creates a new XataStore instance from an array of documents.
   * @static
   * @param {Document[]} docs - An array of documents to be added to the store.
   * @param {Embeddings} embeddings - The embeddings object for transforming documents into vector representations.
   * @param {XataLibArgs} dbConfig - Configuration options for the XataStore.
   * @return {Promise<XataStore>} - Returns a Promise that resolves to a new XataStore instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: XataLibArgs
  ): Promise<XataStore> {
    const args = dbConfig;

    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Creates a new XataStore instance from an existing index.
   * @static
   * @param {Embeddings} embeddings - The embeddings object for transforming documents into vector representations.
   * @param {XataLibArgs} dbConfig - Configuration options for the XataStore.
   * @return {Promise<XataStore>} - Returns a Promise that resolves to a new XataStore instance.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: XataLibArgs
  ): Promise<XataStore> {
    const instance = new this(embeddings, dbConfig);
    return await Promise.resolve(instance);
  }
}

/**
 * File name
 *
 * @maxLength 1024
 * @minLength 0
 * @pattern [0-9a-zA-Z!\-_\.\*'\(\)]*
 */
type FileName = string;

/**
 * Media type
 *
 * @maxLength 255
 * @minLength 3
 * @pattern ^\w+/[-+.\w]+$
 */
type MediaType = string;

/**
 * Unique file identifier
 *
 * @maxLength 255
 * @minLength 1
 * @pattern [a-zA-Z0-9_-~:]+
 */
type FileID = string;

/**
 * @format date-time
 */
type DateTime = string;

/**
 * Object column value
 */
type ObjectValue = {
  [key: string]:
    | string
    | boolean
    | number
    | string[]
    | number[]
    | DateTime
    | ObjectValue;
};

/**
 * Object representing a file
 */
interface InputFile {
  name: FileName;
  mediaType?: MediaType;
  /*
   * Base64 encoded content
   *
   * @maxLength 20971520
   */
  base64Content?: string;
  /*
   * Enable public access to the file
   */
  enablePublicUrl?: boolean;
  /*
   * Time to live for signed URLs
   */
  signedUrlTimeout?: number;
}

/**
 * Object representing a file in an array
 */
interface InputFileEntry {
  id?: FileID;
  name?: FileName;
  mediaType?: MediaType;
  /*
   * Base64 encoded content
   *
   * @maxLength 20971520
   */
  base64Content?: string;
  /*
   * Enable public access to the file
   */
  enablePublicUrl?: boolean;
  /*
   * Time to live for signed URLs
   */
  signedUrlTimeout?: number;
}

/**
 * Array of file entries
 *
 * @maxItems 50
 */
type InputFileArray = InputFileEntry[];

/**
 * Xata input record
 */
type DataInputRecord = {
  [key: string]:
    | RecordID
    | string
    | boolean
    | number
    | string[]
    | number[]
    | DateTime
    | ObjectValue
    | InputFileArray
    | InputFile
    | null;
};

interface BulkInsertTableRecords {
  records: DataInputRecord[];
}

type FilterRangeValue = number | string;

interface VectorSearchTable {
  /*
   * The vector to search for similarities. Must have the same dimension as
   * the vector column used.
   */
  queryVector: number[];
  /*
   * The vector column in which to search. It must be of type `vector`.
   */
  column: string;
  /*
   * The function used to measure the distance between two points. Can be one of:
   * `cosineSimilarity`, `l1`, `l2`. The default is `cosineSimilarity`.
   *
   * @default cosineSimilarity
   */
  similarityFunction?: string;
  /*
   * Number of results to return.
   *
   * @default 10
   * @maximum 100
   * @minimum 1
   */
  size?: number;
  filter?: XataFilterExpression;
}

type FilterPredicate =
  | FilterValue
  | FilterPredicate[]
  | FilterPredicateOp
  | FilterPredicateRangeOp;

/**
 * @maxProperties 1
 * @minProperties 1
 */
interface FilterColumnIncludes {
  $includes?: FilterPredicate;
  $includesAny?: FilterPredicate;
  $includesAll?: FilterPredicate;
  $includesNone?: FilterPredicate;
}

type FilterList = XataFilterExpression | XataFilterExpression[];

type FilterColumn = FilterColumnIncludes | FilterPredicate | FilterList;

type FilterValue = number | string | boolean;

/**
 * @maxProperties 1
 * @minProperties 1
 */
interface FilterPredicateOp {
  $any?: FilterPredicate[];
  $all?: FilterPredicate[];
  $none?: FilterPredicate | FilterPredicate[];
  $not?: FilterPredicate | FilterPredicate[];
  $is?: FilterValue | FilterValue[];
  $isNot?: FilterValue | FilterValue[];
  $lt?: FilterRangeValue;
  $le?: FilterRangeValue;
  $gt?: FilterRangeValue;
  $ge?: FilterRangeValue;
  $contains?: string;
  $startsWith?: string;
  $endsWith?: string;
  $pattern?: string;
}

/**
 * @maxProperties 2
 * @minProperties 2
 */
interface FilterPredicateRangeOp {
  $lt?: FilterRangeValue;
  $le?: FilterRangeValue;
  $gt?: FilterRangeValue;
  $ge?: FilterRangeValue;
}

interface VectorSearchResults {
  records: Record[];
  warning?: string;
}

/**
 * Xata Table Record Metadata
 */
type Record = RecordMeta & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

/**
 * Xata Table Record Metadata
 */
interface RecordMeta {
  id: RecordID;
  xata: {
    /*
     * The record's version. Can be used for optimistic concurrency control.
     */
    version: number;
    /*
     * The record's table name. APIs that return records from multiple tables will set this field accordingly.
     */
    table?: string;
    /*
     * Highlights of the record. This is used by the search APIs to indicate which fields and parts of the fields have matched the search.
     */
    highlight?: {
      [key: string]:
        | string[]
        | {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [key: string]: any;
          };
    };
    /*
     * The record's relevancy score. This is returned by the search APIs.
     */
    score?: number;
    /*
     * Encoding/Decoding errors
     */
    warnings?: string[];
  };
}

/**
 * @maxLength 255
 * @minLength 1
 * @pattern [a-zA-Z0-9_-~:]+
 */
type RecordID = string;
