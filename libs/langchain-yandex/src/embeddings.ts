import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";

const apiUrl =
  "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding";

export interface YandexGPTEmbeddingsParams extends EmbeddingsParams {
  /** Model name to use. */
  model?: string;

  /** Model version to use. */
  modelVersion?: string;

  /** Model version to use. */

  /** Model URI to use. */
  modelURI?: string;

  /** Yandex Cloud Folder ID. */
  folderID?: string;

  /**
   * Yandex Cloud Api Key for service account
   * with the `ai.languageModels.user` role.
   */
  apiKey?: string;

  /**
   * Yandex Cloud IAM token for service or user account
   * with the `ai.languageModels.user` role.
   */
  iamToken?: string;
}

/**
 * Class for generating embeddings using the YandexGPT Foundation models API. Extends the
 * Embeddings class and implements YandexGPTEmbeddings
 */
export class YandexGPTEmbeddings
  extends Embeddings
  implements YandexGPTEmbeddingsParams
{
  model = "text-search-query";

  modelVersion = "latest";

  modelURI?: string;

  apiKey?: string;

  iamToken?: string;

  folderID?: string;

  constructor(fields?: YandexGPTEmbeddingsParams) {
    super(fields ?? {});

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("YC_API_KEY");

    const iamToken = fields?.iamToken ?? getEnvironmentVariable("YC_IAM_TOKEN");

    const folderID = fields?.folderID ?? getEnvironmentVariable("YC_FOLDER_ID");

    if (apiKey === undefined && iamToken === undefined) {
      throw new Error(
        "Please set the YC_API_KEY or YC_IAM_TOKEN environment variable or pass it to the constructor as the apiKey or iamToken field."
      );
    }

    this.modelURI = fields?.modelURI;
    this.apiKey = apiKey;
    this.iamToken = iamToken;
    this.folderID = folderID;
    this.model = fields?.model ?? this.model;
    this.modelVersion = fields?.modelVersion ?? this.modelVersion;

    if (this.modelURI === undefined && folderID === undefined) {
      throw new Error(
        "Please set the YC_FOLDER_ID environment variable or pass Yandex GPT model URI to the constructor as the modelURI field."
      );
    }

    if (!this.modelURI) {
      this.modelURI = `emb://${this.folderID}/${this.model}/${this.modelVersion}`;
    }
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "YC_API_KEY",
      iamToken: "YC_IAM_TOKEN",
      folderID: "YC_FOLDER_ID",
    };
  }

  /**
   * Method to generate embeddings for an array of documents.
   * @param texts Array of documents to generate embeddings for.
   * @returns Promise that resolves to a 2D array of embeddings for each document.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embeddingWithRetry(texts);
  }

  /**
   * Method to generate an embedding for a single document. Calls the
   * embedDocuments method with the document as the input.
   * @param text Document to generate an embedding for.
   * @returns Promise that resolves to an embedding for the document.
   */
  async embedQuery(text: string): Promise<number[]> {
    const data = await this.embedDocuments([text]);
    return data[0];
  }

  /**
   * Private method to make a request to the YandexGPT API to generate
   * embeddings. Handles the retry logic and returns the embeddings from the API.
   * @param {string | Array<string>} texts Array of documents to generate embeddings for.
   * @returns {Promise<MistralAIEmbeddingsResult>} Promise that resolves to a 2D array of embeddings for each document.
   */
  private async embeddingWithRetry(texts: string[]): Promise<number[][]> {
    return this.caller.call(async () => {
      const headers = {
        "Content-Type": "application/json",
        Authorization: "",
        "x-folder-id": "",
      };
      if (this.apiKey !== undefined) {
        headers.Authorization = `Api-Key ${this.apiKey}`;
      } else {
        headers.Authorization = `Bearer ${this.iamToken}`;
        if (this.folderID !== undefined) {
          headers["x-folder-id"] = this.folderID;
        }
      }

      const embeddings: number[][] = [];

      for (const text of texts) {
        const bodyData = {
          modelUri: this.modelURI,
          text,
        };

        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(bodyData),
          });
          if (!response.ok) {
            throw new Error(
              `Failed to fetch ${apiUrl} from YandexGPT: ${response.status}`
            );
          }

          const responseData = await response.json();

          embeddings.push(responseData.embedding);
        } catch (error) {
          throw new Error(`Failed to fetch ${apiUrl} from YandexGPT ${error}`);
        }
      }

      return embeddings;
    });
  }
}
