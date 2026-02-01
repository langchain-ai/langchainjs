import { LlamaModel, LlamaEmbeddingContext, getLlama } from "node-llama-cpp";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import {
  LlamaBaseCppInputs,
  createLlamaModel,
  createLlamaEmbeddingContext,
} from "../utils/llama_cpp.js";

/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface LlamaCppEmbeddingsParams
  extends LlamaBaseCppInputs,
    EmbeddingsParams {}

/**
 * @example
 * ```typescript
 * // Initialize LlamaCppEmbeddings with the path to the model file
 * const embeddings = await LlamaCppEmbeddings.initialize({
 *   modelPath: llamaPath,
 * });
 *
 * // Embed a query string using the Llama embeddings
 * const res = embeddings.embedQuery("Hello Llama!");
 *
 * // Output the resulting embeddings
 * console.log(res);
 *
 * ```
 */
export class LlamaCppEmbeddings extends Embeddings {
  _model: LlamaModel;

  _embeddingContext: LlamaEmbeddingContext;

  public constructor(inputs: LlamaCppEmbeddingsParams) {
    super(inputs);
    const _inputs = inputs;
    _inputs.embedding = true;
  }

  /**
   * Initializes the llama_cpp model for usage in the embeddings wrapper.
   * @param inputs - the inputs passed onto the model.
   * @returns A Promise that resolves to the LlamaCppEmbeddings type class.
   */
  public static async initialize(
    inputs: LlamaBaseCppInputs
  ): Promise<LlamaCppEmbeddings> {
    const instance = new LlamaCppEmbeddings(inputs);
    const llama = await getLlama();

    instance._model = await createLlamaModel(inputs, llama);
    instance._embeddingContext = await createLlamaEmbeddingContext(
      instance._model,
      inputs
    );

    return instance;
  }

  /**
   * Generates embeddings for an array of texts.
   * @param texts - An array of strings to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.caller.call(() =>
        this._embeddingContext.getEmbeddingFor(text)
      );
      embeddings.push(Array.from(embedding.vector));
    }

    return embeddings;
  }

  /**
   * Generates an embedding for a single text.
   * @param text - A string to generate an embedding for.
   * @returns A Promise that resolves to an array of numbers representing the embedding.
   */
  async embedQuery(text: string): Promise<number[]> {
    const embedding = await this.caller.call(() =>
      this._embeddingContext.getEmbeddingFor(text)
    );
    return Array.from(embedding.vector);
  }
}
