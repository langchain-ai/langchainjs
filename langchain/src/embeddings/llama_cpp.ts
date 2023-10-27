import { LlamaModel, LlamaContext } from "node-llama-cpp";
import { Embeddings, EmbeddingsParams } from "./base.js";

export interface LlamaCppEmbeddingsParams extends EmbeddingsParams {
    /** Prompt processing batch size. */
    batchSize?: number;
    /** Text context size. */
    contextSize?: number;
    /** Use fp16 for KV cache. */
    f16Kv?: boolean;
    /** Number of layers to store in VRAM. */
    gpuLayers?: number;
    /** The llama_eval() call computes all logits, not just the last one. */
    logitsAll?: boolean;
    /** Path to the model on the filesystem. */
    modelPath: string;
    /** Add the begining of sentence token.  */
    prependBos?: boolean;
    /** If null, a random seed will be used. */
    seed?: null | number;
    /** Force system to keep model in RAM. */
    useMlock?: boolean;
    /** Use mmap if possible. */
    useMmap?: boolean;
    /** Only load the vocabulary, no weights. */
    vocabOnly?: boolean;
}

export class LlamaCppEmbeddings
  extends Embeddings
  implements LlamaCppEmbeddingsParams
{
    batchSize?: number;

    contextSize?: number;

    embedding: boolean;

    f16Kv?: boolean;

    gpuLayers?: number;

    logitsAll?: boolean;

    prependBos?: boolean;

    seed?: null | number;

    useMlock?: boolean;

    useMmap?: boolean;

    vocabOnly?: boolean;

    modelPath: string;

    _model: LlamaModel;

    _context: LlamaContext;


    constructor(inputs: LlamaCppEmbeddingsParams) {
      super(inputs);
      this.batchSize = inputs.batchSize;
      this.contextSize = inputs.contextSize;
      this.embedding = true;
      this.f16Kv = inputs.f16Kv;
      this.gpuLayers = inputs.gpuLayers;
      this.logitsAll = inputs.logitsAll;
      this.prependBos = inputs.prependBos;
      this.modelPath = inputs.modelPath;
      this.seed = inputs.seed;
      this.useMlock = inputs.useMlock;
      this.useMmap = inputs.useMmap;
      this.vocabOnly = inputs.vocabOnly;
      this._model = new LlamaModel(inputs);
      this._context = new LlamaContext({ model: this._model });
    }

    /**
     * Generates embeddings for an array of texts.
     * @param texts - An array of strings to generate embeddings for.
     * @returns A Promise that resolves to an array of embeddings.
     */
    async embedDocuments(texts: string[]): Promise<number[][]> {
        return new Promise(resolve => {
            const tokensArray = texts.map((text) =>
              this._context.encode(text)
            );

            const embeddings: number[][] = [];

            for (const tokens of tokensArray) {
				const embedArray: number[] = [];

                for (const token in tokens) {
					const nToken: number = +token;
                    embedArray.push(nToken);
                }

				embeddings.push(embedArray);
            }

            resolve(embeddings);
        });


    }

    /**
     * Generates an embedding for a single text.
     * @param text - A string to generate an embedding for.
     * @returns A Promise that resolves to an array of numbers representing the embedding.
     */
    async embedQuery(text: string): Promise<number[]> {
      return new Promise(resolve => {
          let tokens: number[] = [];

          const tokensObj = this._context.encode(text);
          for (const token in tokensObj) {
			  const nToken: number = +token;
              tokens.push(nToken);
          }

          resolve(tokens);
      });
   }
}
