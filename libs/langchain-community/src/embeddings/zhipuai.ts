import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";

import { encodeApiKey } from "../utils/zhipuai.js";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the ZhipuAIEmbeddingsParams class.
 */
export interface ZhipuAIEmbeddingsParams extends EmbeddingsParams {
  /**
   * Model Name to use
   */
  modelName?: "embedding-2" | "embedding-3";
  /**
   * ZhipuAI API key to use
   */
  apiKey?: string;
  /**
   * Whether to strip new lines from the input text.
   */
  stripNewLines?: boolean;
}

interface EmbeddingData {
  embedding: number[];
  index: number;
  object: string;
}

interface TokenUsage {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
}

export interface ZhipuAIEmbeddingsResult {
  model: string;
  data: EmbeddingData[];
  object: string;
  usage: TokenUsage;
}

export class ZhipuAIEmbeddings
  extends Embeddings
  implements ZhipuAIEmbeddingsParams
{
  modelName: ZhipuAIEmbeddingsParams["modelName"] = "embedding-2";

  apiKey?: string;

  stripNewLines = true;

  private embeddingsAPIURL = "https://open.bigmodel.cn/api/paas/v4/embeddings";

  constructor(fields?: ZhipuAIEmbeddingsParams) {
    super(fields ?? {});

    this.modelName = fields?.modelName ?? this.modelName;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
    this.apiKey = fields?.apiKey ?? getEnvironmentVariable("ZHIPUAI_API_KEY");

    if (!this.apiKey) {
      throw new Error("ZhipuAI API key not found");
    }
  }

  /**
   * Private method to make a request to the TogetherAI API to generate
   * embeddings. Handles the retry logic and returns the response from the API.
   * @param {string} input The input text to embed.
   * @returns Promise that resolves to the response from the API.
   * @TODO Figure out return type and statically type it.
   */
  private async embeddingWithRetry(
    input: string
  ): Promise<ZhipuAIEmbeddingsResult> {
    const text = this.stripNewLines ? input.replace(/\n/g, " ") : input;

    const body = JSON.stringify({ input: text, model: this.modelName });
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: encodeApiKey(this.apiKey),
    };

    return this.caller.call(async () => {
      const fetchResponse = await fetch(this.embeddingsAPIURL, {
        method: "POST",
        headers,
        body,
      });

      if (fetchResponse.status === 200) {
        return fetchResponse.json();
      }
      throw new Error(
        `Error getting embeddings from ZhipuAI. ${JSON.stringify(
          await fetchResponse.json(),
          null,
          2
        )}`
      );
    });
  }

  /**
   * Method to generate an embedding for a single document. Calls the
   * embeddingWithRetry method with the document as the input.
   * @param {string} text Document to generate an embedding for.
   * @returns {Promise<number[]>} Promise that resolves to an embedding for the document.
   */
  async embedQuery(text: string): Promise<number[]> {
    const { data } = await this.embeddingWithRetry(text);
    return data[0].embedding;
  }

  /**
   * Method that takes an array of documents as input and returns a promise
   * that resolves to a 2D array of embeddings for each document. It calls
   * the embedQuery method for each document in the array.
   * @param documents Array of documents for which to generate embeddings.
   * @returns Promise that resolves to a 2D array of embeddings for each input document.
   */
  embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.all(documents.map((doc) => this.embedQuery(doc)));
  }
}
