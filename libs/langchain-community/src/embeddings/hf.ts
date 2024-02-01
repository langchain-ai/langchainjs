import { HfInference, HfInferenceEndpoint } from "@huggingface/inference";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the HuggingFaceInferenceEmbeddings class.
 */
export interface HuggingFaceInferenceEmbeddingsParams extends EmbeddingsParams {
  apiKey?: string;
  model?: string;
  endpointUrl?: string;
}

/**
 * Class that extends the Embeddings class and provides methods for
 * generating embeddings using Hugging Face models through the
 * HuggingFaceInference API.
 */
export class HuggingFaceInferenceEmbeddings
  extends Embeddings
  implements HuggingFaceInferenceEmbeddingsParams
{
  apiKey?: string;

  model: string;

  endpointUrl?: string;

  client: HfInference | HfInferenceEndpoint;

  constructor(fields?: HuggingFaceInferenceEmbeddingsParams) {
    super(fields ?? {});

    this.model = fields?.model ?? "BAAI/bge-base-en-v1.5";
    this.apiKey =
      fields?.apiKey ?? getEnvironmentVariable("HUGGINGFACEHUB_API_KEY");
    this.endpointUrl = fields?.endpointUrl;
    this.client = this.endpointUrl
      ? new HfInference(this.apiKey).endpoint(this.endpointUrl)
      : new HfInference(this.apiKey);
  }

  async _embed(texts: string[]): Promise<number[][]> {
    // replace newlines, which can negatively affect performance.
    const clean = texts.map((text) => text.replace(/\n/g, " "));
    return this.caller.call(() =>
      this.client.featureExtraction({
        model: this.model,
        inputs: clean,
      })
    ) as Promise<number[][]>;
  }

  /**
   * Method that takes a document as input and returns a promise that
   * resolves to an embedding for the document. It calls the _embed method
   * with the document as the input and returns the first embedding in the
   * resulting array.
   * @param document Document to generate an embedding for.
   * @returns Promise that resolves to an embedding for the document.
   */
  embedQuery(document: string): Promise<number[]> {
    return this._embed([document]).then((embeddings) => embeddings[0]);
  }

  /**
   * Method that takes an array of documents as input and returns a promise
   * that resolves to a 2D array of embeddings for each document. It calls
   * the _embed method with the documents as the input.
   * @param documents Array of documents to generate embeddings for.
   * @returns Promise that resolves to a 2D array of embeddings for each document.
   */
  embedDocuments(documents: string[]): Promise<number[][]> {
    return this._embed(documents);
  }
}
