import * as uuid from "uuid";
import flatten from "flat";
import { GoogleAuth, GoogleAuthOptions } from "google-auth-library";
import { VectorStore } from "@langchain/core/vectorstores";
import { Embeddings } from "@langchain/core/embeddings";
import { Document, DocumentInput } from "@langchain/core/documents";
import {
  AsyncCaller,
  AsyncCallerCallOptions,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";

import { GoogleVertexAIConnection } from "../utils/googlevertexai-connection.js";
import { Docstore } from "../stores/doc/base.js";
import {
  GoogleVertexAIConnectionParams,
  GoogleResponse,
  GoogleAbstractedClientOpsMethod,
} from "../types/googlevertexai-types.js";

/**
 * Allows us to create IdDocument classes that contain the ID.
 */
export interface IdDocumentInput extends DocumentInput {
  id?: string;
}

/**
 * A Document that optionally includes the ID of the document.
 */
export class IdDocument extends Document implements IdDocumentInput {
  id?: string;

  constructor(fields: IdDocumentInput) {
    super(fields);
    this.id = fields.id;
  }
}

interface IndexEndpointConnectionParams
  extends GoogleVertexAIConnectionParams<GoogleAuthOptions> {
  indexEndpoint: string;
}

interface DeployedIndex {
  id: string;
  index: string;
  // There are other attributes, but we don't care about them right now
}

interface IndexEndpointResponse extends GoogleResponse {
  data: {
    deployedIndexes: DeployedIndex[];
    publicEndpointDomainName: string;
    // There are other attributes, but we don't care about them right now
  };
}

class IndexEndpointConnection extends GoogleVertexAIConnection<
  AsyncCallerCallOptions,
  IndexEndpointResponse,
  GoogleAuthOptions
> {
  indexEndpoint: string;

  constructor(fields: IndexEndpointConnectionParams, caller: AsyncCaller) {
    super(fields, caller, new GoogleAuth(fields.authOptions));

    this.indexEndpoint = fields.indexEndpoint;
  }

  async buildUrl(): Promise<string> {
    const projectId = await this.client.getProjectId();
    const url = `https://${this.endpoint}/${this.apiVersion}/projects/${projectId}/locations/${this.location}/indexEndpoints/${this.indexEndpoint}`;
    return url;
  }

  buildMethod(): GoogleAbstractedClientOpsMethod {
    return "GET";
  }

  async request(
    options: AsyncCallerCallOptions
  ): Promise<IndexEndpointResponse> {
    return this._request(undefined, options);
  }
}

/**
 * Used to represent parameters that are necessary to delete documents
 * from the matching engine. These must be a list of string IDs
 */
export interface MatchingEngineDeleteParams {
  ids: string[];
}

interface RemoveDatapointParams
  extends GoogleVertexAIConnectionParams<GoogleAuthOptions> {
  index: string;
}

interface RemoveDatapointRequest {
  datapointIds: string[];
}

interface RemoveDatapointResponse extends GoogleResponse {
  // Should be empty
}

class RemoveDatapointConnection extends GoogleVertexAIConnection<
  AsyncCallerCallOptions,
  RemoveDatapointResponse,
  GoogleAuthOptions
> {
  index: string;

  constructor(fields: RemoveDatapointParams, caller: AsyncCaller) {
    super(fields, caller, new GoogleAuth(fields.authOptions));

    this.index = fields.index;
  }

  async buildUrl(): Promise<string> {
    const projectId = await this.client.getProjectId();
    const url = `https://${this.endpoint}/${this.apiVersion}/projects/${projectId}/locations/${this.location}/indexes/${this.index}:removeDatapoints`;
    return url;
  }

  buildMethod(): GoogleAbstractedClientOpsMethod {
    return "POST";
  }

  async request(
    datapointIds: string[],
    options: AsyncCallerCallOptions
  ): Promise<RemoveDatapointResponse> {
    const data: RemoveDatapointRequest = {
      datapointIds,
    };
    return this._request(data, options);
  }
}

interface UpsertDatapointParams
  extends GoogleVertexAIConnectionParams<GoogleAuthOptions> {
  index: string;
}

export interface Restriction {
  namespace: string;
  allowList?: string[];
  denyList?: string[];
}

interface CrowdingTag {
  crowdingAttribute: string;
}

interface IndexDatapoint {
  datapointId: string;
  featureVector: number[];
  restricts?: Restriction[];
  crowdingTag?: CrowdingTag;
}

interface UpsertDatapointRequest {
  datapoints: IndexDatapoint[];
}

interface UpsertDatapointResponse extends GoogleResponse {
  // Should be empty
}

class UpsertDatapointConnection extends GoogleVertexAIConnection<
  AsyncCallerCallOptions,
  UpsertDatapointResponse,
  GoogleAuthOptions
> {
  index: string;

  constructor(fields: UpsertDatapointParams, caller: AsyncCaller) {
    super(fields, caller, new GoogleAuth(fields.authOptions));

    this.index = fields.index;
  }

  async buildUrl(): Promise<string> {
    const projectId = await this.client.getProjectId();
    const url = `https://${this.endpoint}/${this.apiVersion}/projects/${projectId}/locations/${this.location}/indexes/${this.index}:upsertDatapoints`;
    return url;
  }

  buildMethod(): GoogleAbstractedClientOpsMethod {
    return "POST";
  }

  async request(
    datapoints: IndexDatapoint[],
    options: AsyncCallerCallOptions
  ): Promise<UpsertDatapointResponse> {
    const data: UpsertDatapointRequest = {
      datapoints,
    };
    return this._request(data, options);
  }
}

interface FindNeighborsConnectionParams
  extends GoogleVertexAIConnectionParams<GoogleAuthOptions> {
  indexEndpoint: string;

  deployedIndexId: string;
}

interface FindNeighborsRequestQuery {
  datapoint: {
    datapointId: string;
    featureVector: number[];
    restricts?: Restriction[];
  };
  neighborCount: number;
}

interface FindNeighborsRequest {
  deployedIndexId: string;
  queries: FindNeighborsRequestQuery[];
}

interface FindNeighborsResponseNeighbor {
  datapoint: {
    datapointId: string;
    crowdingTag: {
      crowdingTagAttribute: string;
    };
  };
  distance: number;
}

interface FindNeighborsResponseNearestNeighbor {
  id: string;
  neighbors: FindNeighborsResponseNeighbor[];
}

interface FindNeighborsResponse extends GoogleResponse {
  data: {
    nearestNeighbors: FindNeighborsResponseNearestNeighbor[];
  };
}

class FindNeighborsConnection
  extends GoogleVertexAIConnection<
    AsyncCallerCallOptions,
    FindNeighborsResponse,
    GoogleAuthOptions
  >
  implements FindNeighborsConnectionParams
{
  indexEndpoint: string;

  deployedIndexId: string;

  constructor(params: FindNeighborsConnectionParams, caller: AsyncCaller) {
    super(params, caller, new GoogleAuth(params.authOptions));

    this.indexEndpoint = params.indexEndpoint;
    this.deployedIndexId = params.deployedIndexId;
  }

  async buildUrl(): Promise<string> {
    const projectId = await this.client.getProjectId();
    const url = `https://${this.endpoint}/${this.apiVersion}/projects/${projectId}/locations/${this.location}/indexEndpoints/${this.indexEndpoint}:findNeighbors`;
    return url;
  }

  buildMethod(): GoogleAbstractedClientOpsMethod {
    return "POST";
  }

  async request(
    request: FindNeighborsRequest,
    options: AsyncCallerCallOptions
  ): Promise<FindNeighborsResponse> {
    return this._request(request, options);
  }
}

/**
 * Information about the Matching Engine public API endpoint.
 * Primarily exported to allow for testing.
 */
export interface PublicAPIEndpointInfo {
  apiEndpoint?: string;

  deployedIndexId?: string;
}

/**
 * Parameters necessary to configure the Matching Engine.
 */
export interface MatchingEngineArgs
  extends GoogleVertexAIConnectionParams<GoogleAuthOptions>,
    IndexEndpointConnectionParams,
    UpsertDatapointParams {
  docstore: Docstore;

  callerParams?: AsyncCallerParams;

  callerOptions?: AsyncCallerCallOptions;

  apiEndpoint?: string;

  deployedIndexId?: string;
}

/**
 * A class that represents a connection to a Google Vertex AI Matching Engine
 * instance.
 */
export class MatchingEngine extends VectorStore implements MatchingEngineArgs {
  declare FilterType: Restriction[];

  /**
   * Docstore that retains the document, stored by ID
   */
  docstore: Docstore;

  /**
   * The host to connect to for queries and upserts.
   */
  apiEndpoint: string;

  apiVersion = "v1";

  endpoint = "us-central1-aiplatform.googleapis.com";

  location = "us-central1";

  /**
   * The id for the index endpoint
   */
  indexEndpoint: string;

  /**
   * The id for the index
   */
  index: string;

  /**
   * Explicitly set Google Auth credentials if you cannot get them from google auth application-default login
   * This is useful for serverless or autoscaling environments like Fargate
   */
  authOptions: GoogleAuthOptions;

  /**
   * The id for the "deployed index", which is an identifier in the
   * index endpoint that references the index (but is not the index id)
   */
  deployedIndexId: string;

  callerParams: AsyncCallerParams;

  callerOptions: AsyncCallerCallOptions;

  caller: AsyncCaller;

  indexEndpointClient: IndexEndpointConnection;

  removeDatapointClient: RemoveDatapointConnection;

  upsertDatapointClient: UpsertDatapointConnection;

  constructor(embeddings: Embeddings, args: MatchingEngineArgs) {
    super(embeddings, args);

    this.embeddings = embeddings;
    this.docstore = args.docstore;

    this.apiEndpoint = args.apiEndpoint ?? this.apiEndpoint;
    this.deployedIndexId = args.deployedIndexId ?? this.deployedIndexId;

    this.apiVersion = args.apiVersion ?? this.apiVersion;
    this.endpoint = args.endpoint ?? this.endpoint;
    this.location = args.location ?? this.location;
    this.indexEndpoint = args.indexEndpoint ?? this.indexEndpoint;
    this.index = args.index ?? this.index;
    this.authOptions = args.authOptions ?? this.authOptions;

    this.callerParams = args.callerParams ?? this.callerParams;
    this.callerOptions = args.callerOptions ?? this.callerOptions;
    this.caller = new AsyncCaller(this.callerParams || {});

    const indexClientParams: IndexEndpointConnectionParams = {
      endpoint: this.endpoint,
      location: this.location,
      apiVersion: this.apiVersion,
      indexEndpoint: this.indexEndpoint,
      authOptions: this.authOptions,
    };
    this.indexEndpointClient = new IndexEndpointConnection(
      indexClientParams,
      this.caller
    );

    const removeClientParams: RemoveDatapointParams = {
      endpoint: this.endpoint,
      location: this.location,
      apiVersion: this.apiVersion,
      index: this.index,
      authOptions: this.authOptions,
    };
    this.removeDatapointClient = new RemoveDatapointConnection(
      removeClientParams,
      this.caller
    );

    const upsertClientParams: UpsertDatapointParams = {
      endpoint: this.endpoint,
      location: this.location,
      apiVersion: this.apiVersion,
      index: this.index,
      authOptions: this.authOptions,
    };
    this.upsertDatapointClient = new UpsertDatapointConnection(
      upsertClientParams,
      this.caller
    );
  }

  _vectorstoreType(): string {
    return "googlevertexai";
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts: string[] = documents.map((doc) => doc.pageContent);
    const vectors: number[][] = await this.embeddings.embedDocuments(texts);
    return this.addVectors(vectors, documents);
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadata must have the same length`);
    }
    const datapoints: IndexDatapoint[] = vectors.map((vector, idx) =>
      this.buildDatapoint(vector, documents[idx])
    );
    const options = {};
    const response = await this.upsertDatapointClient.request(
      datapoints,
      options
    );
    if (Object.keys(response?.data ?? {}).length === 0) {
      // Nothing in the response in the body means we saved it ok
      const idDoc = documents as IdDocument[];
      const docsToStore: Record<string, Document> = {};
      idDoc.forEach((doc) => {
        if (doc.id) {
          docsToStore[doc.id] = doc;
        }
      });
      await this.docstore.add(docsToStore);
    }
  }

  // TODO: Refactor this into a utility type and use with pinecone as well?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cleanMetadata(documentMetadata: Record<string, any>): {
    [key: string]: string | number | boolean | string[] | null;
  } {
    type metadataType = {
      [key: string]: string | number | boolean | string[] | null;
    };

    function getStringArrays(
      prefix: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      m: Record<string, any>
    ): Record<string, string[]> {
      let ret: Record<string, string[]> = {};

      Object.keys(m).forEach((key) => {
        const newPrefix = prefix.length > 0 ? `${prefix}.${key}` : key;
        const val = m[key];
        if (!val) {
          // Ignore it
        } else if (Array.isArray(val)) {
          // Make sure everything in the array is a string
          ret[newPrefix] = val.map((v) => `${v}`);
        } else if (typeof val === "object") {
          const subArrays = getStringArrays(newPrefix, val);
          ret = { ...ret, ...subArrays };
        }
      });

      return ret;
    }

    const stringArrays: Record<string, string[]> = getStringArrays(
      "",
      documentMetadata
    );

    const flatMetadata: metadataType = flatten(documentMetadata);
    Object.keys(flatMetadata).forEach((key) => {
      Object.keys(stringArrays).forEach((arrayKey) => {
        const matchKey = `${arrayKey}.`;
        if (key.startsWith(matchKey)) {
          delete flatMetadata[key];
        }
      });
    });

    const metadata: metadataType = {
      ...flatMetadata,
      ...stringArrays,
    };
    return metadata;
  }

  /**
   * Given the metadata from a document, convert it to an array of Restriction
   * objects that may be passed to the Matching Engine and stored.
   * The default implementation flattens any metadata and includes it as
   * an "allowList". Subclasses can choose to convert some of these to
   * "denyList" items or to add additional restrictions (for example, to format
   * dates into a different structure or to add additional restrictions
   * based on the date).
   * @param documentMetadata - The metadata from a document
   * @returns a Restriction[] (or an array of a subclass, from the FilterType)
   */
  metadataToRestrictions(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documentMetadata: Record<string, any>
  ): this["FilterType"] {
    const metadata = this.cleanMetadata(documentMetadata);

    const restrictions: this["FilterType"] = [];
    for (const key of Object.keys(metadata)) {
      // Make sure the value is an array (or that we'll ignore it)
      let valArray;
      const val = metadata[key];
      if (val === null) {
        valArray = null;
      } else if (Array.isArray(val) && val.length > 0) {
        valArray = val;
      } else {
        valArray = [`${val}`];
      }

      // Add to the restrictions if we do have a valid value
      if (valArray) {
        // Determine if this key is for the allowList or denyList
        // TODO: get which ones should be on the deny list
        const listType = "allowList";

        // Create the restriction
        const restriction: Restriction = {
          namespace: key,
          [listType]: valArray,
        };

        // Add it to the restriction list
        restrictions.push(restriction);
      }
    }
    return restrictions;
  }

  /**
   * Create an index datapoint for the vector and document id.
   * If an id does not exist, create it and set the document to its value.
   * @param vector
   * @param document
   */
  buildDatapoint(vector: number[], document: IdDocument): IndexDatapoint {
    if (!document.id) {
      // eslint-disable-next-line no-param-reassign
      document.id = uuid.v4();
    }
    const ret: IndexDatapoint = {
      datapointId: document.id,
      featureVector: vector,
    };
    const restrictions = this.metadataToRestrictions(document.metadata);
    if (restrictions?.length > 0) {
      ret.restricts = restrictions;
    }
    return ret;
  }

  async delete(params: MatchingEngineDeleteParams): Promise<void> {
    const options = {};
    await this.removeDatapointClient.request(params.ids, options);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    // Format the query into the request
    const deployedIndexId = await this.getDeployedIndexId();
    const requestQuery: FindNeighborsRequestQuery = {
      neighborCount: k,
      datapoint: {
        datapointId: `0`,
        featureVector: query,
      },
    };
    if (filter) {
      requestQuery.datapoint.restricts = filter;
    }
    const request: FindNeighborsRequest = {
      deployedIndexId,
      queries: [requestQuery],
    };

    // Build the connection.
    // Has to be done here, since we defer getting the endpoint until
    // we need it.
    const apiEndpoint = await this.getPublicAPIEndpoint();
    const findNeighborsParams: FindNeighborsConnectionParams = {
      endpoint: apiEndpoint,
      indexEndpoint: this.indexEndpoint,
      apiVersion: this.apiVersion,
      location: this.location,
      deployedIndexId,
      authOptions: this.authOptions,
    };
    const connection = new FindNeighborsConnection(
      findNeighborsParams,
      this.caller
    );

    // Make the call
    const options = {};
    const response = await connection.request(request, options);

    // Get the document for each datapoint id and return them
    const nearestNeighbors = response?.data?.nearestNeighbors ?? [];
    const nearestNeighbor = nearestNeighbors[0];
    const neighbors = nearestNeighbor?.neighbors ?? [];
    const ret: [Document, number][] = await Promise.all(
      neighbors.map(async (neighbor) => {
        const id = neighbor?.datapoint?.datapointId;
        const distance = neighbor?.distance;
        let doc: IdDocument;
        try {
          doc = await this.docstore.search(id);
        } catch (xx) {
          // Documents that are in the index are returned, even if they
          // are not in the document store, to allow for some way to get
          // the id so they can be deleted.
          console.error(xx);
          console.warn(
            [
              `Document with id "${id}" is missing from the backing docstore.`,
              `This can occur if you clear the docstore without deleting from the corresponding Matching Engine index.`,
              `To resolve this, you should call .delete() with this id as part of the "ids" parameter.`,
            ].join("\n")
          );
          doc = new Document({ pageContent: `Missing document ${id}` });
        }
        doc.id ??= id;
        return [doc, distance];
      })
    );

    return ret;
  }

  /**
   * For this index endpoint, figure out what API Endpoint URL and deployed
   * index ID should be used to do upserts and queries.
   * Also sets the `apiEndpoint` and `deployedIndexId` property for future use.
   * @return The URL
   */
  async determinePublicAPIEndpoint(): Promise<PublicAPIEndpointInfo> {
    const response: IndexEndpointResponse =
      await this.indexEndpointClient.request(this.callerOptions);

    // Get the endpoint
    const publicEndpointDomainName = response?.data?.publicEndpointDomainName;
    this.apiEndpoint = publicEndpointDomainName;

    // Determine which of the deployed indexes match the index id
    // and get the deployed index id. The list of deployed index ids
    // contain the "index name" or path, but not the index id by itself,
    // so we need to extract it from the name
    const indexPathPattern = /projects\/.+\/locations\/.+\/indexes\/(.+)$/;
    const deployedIndexes = response?.data?.deployedIndexes ?? [];
    const deployedIndex = deployedIndexes.find((index) => {
      const deployedIndexPath = index.index;
      const match = deployedIndexPath.match(indexPathPattern);
      if (match) {
        const [, potentialIndexId] = match;
        if (potentialIndexId === this.index) {
          return true;
        }
      }
      return false;
    });
    if (deployedIndex) {
      this.deployedIndexId = deployedIndex.id;
    }

    return {
      apiEndpoint: this.apiEndpoint,
      deployedIndexId: this.deployedIndexId,
    };
  }

  async getPublicAPIEndpoint(): Promise<string> {
    return (
      this.apiEndpoint ?? (await this.determinePublicAPIEndpoint()).apiEndpoint
    );
  }

  async getDeployedIndexId(): Promise<string> {
    return (
      this.deployedIndexId ??
      (await this.determinePublicAPIEndpoint()).deployedIndexId
    );
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: MatchingEngineArgs
  ): Promise<VectorStore> {
    const docs: Document[] = texts.map(
      (text, index): Document => ({
        pageContent: text,
        metadata: Array.isArray(metadatas) ? metadatas[index] : metadatas,
      })
    );
    return this.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: MatchingEngineArgs
  ): Promise<VectorStore> {
    const ret = new MatchingEngine(embeddings, dbConfig);
    await ret.addDocuments(docs);
    return ret;
  }
}
