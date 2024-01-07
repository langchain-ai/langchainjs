import { AsyncCaller, AsyncCallerParams } from "./utils/async_caller.js";

/**
 * The parameters required to initialize an instance of the Embeddings
 * class.
 */
export type GraphParams = AsyncCallerParams;

export type StructuredSchema = {
  nodeProps: Record<string, string[]>;
  relProps: Record<string, string[]>;
  relationships: string[];
};

export interface GraphInterface {

  /**
   * 
   * @returns The schema of the graph as a string.
   */
  getSchema(): string;

  /**
   * 
   * @returns The schema of the graph as a structured object.
   */
  getStructuredSchema(): StructuredSchema;

  /**
   * 
   * @param query 
   * @param params
   * @returns A promise that resolves to an array of results. 
   */
  query(query: string, params: unknown): Promise<unknown[] | undefined>;

  /**
   * @returns A promise that resolves to true if the graph is connected, false otherwise.
   */
  verifyConnectivity(): Promise<boolean>;

  /**
   * Refreshes the schema of the graph.
   * @returns A promise that resolves to void.
   */
  refreshSchema(): Promise<void>;

  /**
   * Closes the graph.
   * @returns A promise that resolves to void.
   */
  close(): Promise<void>;
}

/**
 * An abstract class that provides methods for embedding documents and
 * queries using LangChain.
 */
export abstract class Graph implements GraphInterface {
  /**
   * The async caller should be used by subclasses to make any async calls,
   * which will thus benefit from the concurrency and retry logic.
   */
  caller: AsyncCaller;

  constructor(params: GraphParams) {
    this.caller = new AsyncCaller(params ?? {});
  }

  /**
   * 
   * @returns The schema of the graph as a string.
   */
  abstract getSchema(): string;

  abstract  getStructuredSchema(): StructuredSchema;

  abstract query(query: string, params: unknown): Promise<unknown[] | undefined> ;
  
  abstract verifyConnectivity(): Promise<boolean>;
  
  abstract refreshSchema(): Promise<void>;

  abstract close(): Promise<void>;
}
