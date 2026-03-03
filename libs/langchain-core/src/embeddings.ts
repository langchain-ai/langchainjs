import { AsyncCaller, AsyncCallerParams } from "./utils/async_caller.js";
import { ContentBlock } from "./messages/content/index.js";

/**
 * The parameters required to initialize an instance of the Embeddings
 * class.
 */
export type EmbeddingsParams = AsyncCallerParams;

export interface EmbeddingsInterface<TOutput = number[]> {
  /**
   * An abstract method that takes an array of documents as input and
   * returns a promise that resolves to an array of vectors for each
   * document.
   * @param documents An array of documents to be embedded.
   * @returns A promise that resolves to an array of vectors for each document.
   */
  embedDocuments(documents: string[]): Promise<TOutput[]>;

  /**
   * An abstract method that takes a single document as input and returns a
   * promise that resolves to a vector for the query document.
   * @param document A single document to be embedded.
   * @returns A promise that resolves to a vector for the query document.
   */
  embedQuery(document: string): Promise<TOutput>;
}

/**
 * Experimental additions to the EmbeddingsInterface.
 * The expectation is that these will become part of that interface.
 */
export interface EmbeddingsInterfaceExperimental<TOutput = number[]>
extends EmbeddingsInterface<TOutput> {
  /**
   * Takes an array of multimodal documents as input and
   * returns a promise that resolves to an array of vectors
   * for each document.
   * If one of the input documents has a modality that isn't supported,
   * the resulting output vector will be empty.
   * @param documents An array of multimodal documents to be embedded
   * @returns A promise that resolves to an array of vectors for each document.
   */
  embedContentBlocks(documents: ContentBlock.Standard[]): Promise<(TOutput | undefined)[]>;

  /**
   * Take a single multimodal document as input and returns a
   * promise that resolves to a vector for the query document.
   * If the input document is of a modality that isn't supported,
   * the output vector will be empty.
   * @param document A single document to be embedded.
   * @returns A promise that resolves to a vector for the query document.
   */
  embedContent(document: ContentBlock.Standard): Promise<TOutput | undefined>;
}

/**
 * An abstract class that provides methods for embedding documents and
 * queries using LangChain.
 */
export abstract class Embeddings<
  TOutput = number[],
> implements EmbeddingsInterface<TOutput> {
  /**
   * The async caller should be used by subclasses to make any async calls,
   * which will thus benefit from the concurrency and retry logic.
   */
  caller: AsyncCaller;

  constructor(params: EmbeddingsParams) {
    this.caller = new AsyncCaller(params ?? {});
  }

  /**
   * An abstract method that takes an array of documents as input and
   * returns a promise that resolves to an array of vectors for each
   * document.
   * @param documents An array of documents to be embedded.
   * @returns A promise that resolves to an array of vectors for each document.
   */
  abstract embedDocuments(documents: string[]): Promise<TOutput[]>;

  /**
   * An abstract method that takes a single document as input and returns a
   * promise that resolves to a vector for the query document.
   * @param document A single document to be embedded.
   * @returns A promise that resolves to a vector for the query document.
   */
  abstract embedQuery(document: string): Promise<TOutput>;
}

/**
 * A class that provides methods for embedding multimodal
 * documents and queries using LangChain.
 * This implementation is oriented around backwards compatibility with
 * classes implementing Embeddings. Those that implement support for
 * multimodal embeddings should extend MultimodalEmbeddings.
 * The expectation is that these will become part of the Embeddings class.
 */
export abstract class EmbeddingsExperimental<TOutput = number[]>
  extends Embeddings<TOutput>
  implements EmbeddingsInterfaceExperimental<TOutput> {

  embedContentBlocks(documents: ContentBlock.Standard[]): Promise<(TOutput | undefined)[]> {
    return Promise.all(documents.map((document) => this.embedContent(document)));
  }

  embedContent(document: ContentBlock.Standard): Promise<TOutput | undefined> {
    if (document.type === "text") {
      return this.embedQuery(document.text)
    } else {
      return Promise.resolve(undefined);
    }
  }
}

export abstract class MultimodalEmbeddings<TOutput = number[]>
  implements EmbeddingsInterfaceExperimental<TOutput> {

  /**
   * The async caller should be used by subclasses to make any async calls,
   * which will thus benefit from the concurrency and retry logic.
   */
  caller: AsyncCaller;

  constructor(params: EmbeddingsParams) {
    this.caller = new AsyncCaller(params ?? {});
  }

  embedDocuments(documents: string[]): Promise<TOutput[]> {
    const content = documents.map((document: string): ContentBlock.Text => {
      return {
        type: "text",
        text: document,
      }
    });
    return this.embedContentBlocks(content) as Promise<TOutput[]>;
  }

  embedQuery(document: string): Promise<TOutput> {
    const content: ContentBlock.Text = {
      type: "text",
      text: document,
    };
    return this.embedContent(content) as Promise<TOutput>;
  }

  embedContentBlocks(documents: ContentBlock.Standard[]): Promise<(TOutput | undefined)[]> {
    return Promise.all(documents.map((document) => this.embedContent(document)));
  }

  abstract embedContent(document: ContentBlock.Standard): Promise<TOutput | undefined>;

}