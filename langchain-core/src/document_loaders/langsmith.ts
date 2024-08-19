import { KVMap } from "langsmith/schemas";
import { Document, DocumentInterface } from "../documents/document.js";
import { AsyncCallerParams } from "../utils/async_caller.js";
import { BaseDocumentLoader } from "./base.js";
import { Client } from "langsmith";

// TODO: Replace with import from `langsmith` once exposed.
interface ClientConfig {
  apiUrl?: string;
  apiKey?: string;
  callerOptions?: AsyncCallerParams;
  timeout_ms?: number;
  webUrl?: string;
  anonymizer?: (values: KVMap) => KVMap;
  hideInputs?: boolean | ((inputs: KVMap) => KVMap);
  hideOutputs?: boolean | ((outputs: KVMap) => KVMap);
  autoBatchTracing?: boolean;
  pendingAutoBatchedRunLimit?: number;
  fetchOptions?: RequestInit;
}

export interface LangSmithLoaderFields {
  datasetId?: string;
  datasetName?: string;
  exampleIds?: Array<string>;
  asOf?: Date | string;
  splits?: string[];
  inlineS3Urls?: boolean;
  offset?: number;
  limit?: number;
  metadata?: Record<string, any>;
  filter?: string;
  contentKey?: string;
  formatContent?: (content: any) => string;
  client?: Client;
  clientConfig?: ClientConfig;
}

export class LangSmithLoader extends BaseDocumentLoader {
  datasetId?: string;

  datasetName?: string;

  exampleIds?: Array<string>;

  asOf?: Date | string;

  splits?: string[];

  inlineS3Urls?: boolean;

  offset?: number;

  limit?: number;

  metadata?: Record<string, any>;

  filter?: string;

  contentKey: string[];

  formatContent: (content: any) => string;

  client: Client;

  constructor(fields: LangSmithLoaderFields) {
    super();

    if (fields.client && fields.clientConfig) {
      throw new Error("client and clientConfig cannot both be provided.");
    }
    this.client = fields.client ?? new Client(fields?.clientConfig);
    this.contentKey = fields.contentKey ? fields.contentKey.split(".") : [];
    this.formatContent = fields.formatContent ?? _stringify;
    this.datasetId = fields.datasetId;
    this.datasetName = fields.datasetName;
    this.exampleIds = fields.exampleIds;
    this.asOf = fields.asOf;
    this.splits = fields.splits;
    this.inlineS3Urls = fields.inlineS3Urls;
    this.offset = fields.offset;
    this.limit = fields.limit;
    this.metadata = fields.metadata;
    this.filter = fields.filter;
  }

  async load(): Promise<Document[]> {
    let documents: DocumentInterface[] = [];
    for await (const example of this.client.listExamples({
      datasetId: this.datasetId,
      datasetName: this.datasetName,
      exampleIds: this.exampleIds,
      asOf: this.asOf,
      splits: this.splits,
      inlineS3Urls: this.inlineS3Urls,
      offset: this.offset,
      limit: this.limit,
      metadata: this.metadata,
      filter: this.filter,
    })) {
      let content: any = example.inputs;
      for (const key of this.contentKey) {
        content = content[key];
      }
      const contentStr = this.formatContent(content);

      const metadata: Record<string, any> = example;
      ["datasetId", "createdAt", "modifiedAt", "sourceRunId"].forEach((k) => {
        if (k in metadata) {
          if (typeof metadata[k] === "object") {
            // Dates are of type `object`, we want to convert them to strings.
            metadata[k] = metadata[k].toString();
          }
        }
      });

      documents.push({
        pageContent: contentStr,
        metadata,
      });
    }
    return documents;
  }
}

function _stringify(x: string | Record<string, any>): string {
  if (typeof x === "string") {
    return x;
  } else {
    try {
      return JSON.stringify(x, null, 2);
    } catch (error) {
      return String(x);
    }
  }
}
