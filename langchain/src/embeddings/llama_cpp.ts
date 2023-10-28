import { LlamaModel, LlamaContext } from "node-llama-cpp";
import { LlamaBaseCppInputs, createLlamaModel, createLlamaContext  } from "../util/llama_cpp.js";
import { Embeddings, EmbeddingsParams } from "./base.js";

/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface LlamaCppEmbeddingsParams extends LlamaBaseCppInputs, EmbeddingsParams {
}

export class LlamaCppEmbeddings extends Embeddings {

    _model: LlamaModel;

    _context: LlamaContext;


    constructor(inputs: LlamaCppEmbeddingsParams) {
      super(inputs);
	  inputs.embedding = true;

	  this._model = createLlamaModel(inputs);
      this._context = createLlamaContext(this._model, inputs);
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
