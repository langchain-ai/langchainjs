import { LlamaModel, LlamaContext } from "node-llama-cpp";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import {
  LlamaBaseCppInputs,
  createLlamaModel,
  createLlamaContext,
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
 * const embeddings = new LlamaCppEmbeddings({
 *   modelPath: "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin",
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

  _context: LlamaContext;

  constructor(inputs: LlamaCppEmbeddingsParams) {
    super(inputs);
    const _inputs = inputs;
    _inputs.embedding = true;

    this._model = createLlamaModel(_inputs);
    this._context = createLlamaContext(this._model, _inputs);
  }

  /**
   * Generates embeddings for an array of texts.
   * @param texts - An array of strings to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const tokensArray = [];

    for (const text of texts) {
      const encodings = await this.caller.call(
        () =>
          new Promise((resolve) => {
            resolve(this._context.encode(text));
          })
      );
      tokensArray.push(encodings);
    }

    const embeddings: number[][] = [];

    for (const tokens of tokensArray) {
      const embedArray: number[] = [];

      for (let i = 0; i < tokens.length; i += 1) {
        const nToken: number = +tokens[i];
        embedArray.push(nToken);
      }

      embeddings.push(embedArray);
    }

    return embeddings;
  }

  /**
   * Generates an embedding for a single text.
   * @param text - A string to generate an embedding for.
   * @returns A Promise that resolves to an array of numbers representing the embedding.
   */
  async embedQuery(text: string): Promise<number[]> {
    const tokens: number[] = [];

    const encodings = await this.caller.call(
      () =>
        new Promise((resolve) => {
          resolve(this._context.encode(text));
        })
    );

    for (let i = 0; i < encodings.length; i += 1) {
      const token: number = +encodings[i];
      tokens.push(token);
    }

    return tokens;
  }
}
