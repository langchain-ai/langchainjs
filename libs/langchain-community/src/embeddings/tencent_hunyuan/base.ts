import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { sign } from "../../utils/tencent_hunyuan/common.js";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the TencentHunyuanEmbeddingsParams class.
 */
export interface TencentHunyuanEmbeddingsParams extends EmbeddingsParams {
  /**
   * Tencent Cloud API Host.
   * @default "hunyuan.tencentcloudapi.com"
   */
  host?: string;

  /**
   * SecretID to use when making requests, can be obtained from https://console.cloud.tencent.com/cam/capi.
   * Defaults to the value of `TENCENT_SECRET_ID` environment variable.
   */
  tencentSecretId?: string;

  /**
   * Secret key to use when making requests, can be obtained from https://console.cloud.tencent.com/cam/capi.
   * Defaults to the value of `TENCENT_SECRET_KEY` environment variable.
   */
  tencentSecretKey?: string;
}

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the TencentHunyuanEmbeddingsParams class.
 */
interface TencentHunyuanEmbeddingsParamsWithSign
  extends TencentHunyuanEmbeddingsParams {
  /**
   * Tencent Cloud API v3 sign method.
   */
  sign: sign;
}

/**
 * Interface representing the embedding data.
 * See https://cloud.tencent.com/document/api/1729/101838#EmbeddingData.
 */
interface EmbeddingData {
  Embedding: number[];
  Index: number;
  Object: string;
}

/**
 * Interface representing the usage of tokens in text embedding.
 * See https://cloud.tencent.com/document/api/1729/101838#EmbeddingUsage.
 */
interface EmbeddingUsage {
  TotalTokens: number;
  PromptTokens: number;
  CompletionTokens?: number;
}

/**
 * Interface representing a error response from Tencent Hunyuan embedding.
 * See https://cloud.tencent.com/document/product/1729/102832
 */
interface Error {
  Code: string;
  Message: string;
}

/**
 * Interface representing a response from Tencent Hunyuan embedding.
 * See https://cloud.tencent.com/document/product/1729/102832
 */
interface GetEmbeddingResponse {
  Response: {
    Error?: Error;
    Data: EmbeddingData[];
    Usage: EmbeddingUsage;
    RequestId: string;
  };
}

/**
 * Class for generating embeddings using the Tencent Hunyuan API.
 */
export class TencentHunyuanEmbeddings
  extends Embeddings
  implements TencentHunyuanEmbeddingsParams
{
  tencentSecretId?: string;

  tencentSecretKey?: string;

  host = "hunyuan.tencentcloudapi.com";

  sign: sign;

  constructor(fields?: TencentHunyuanEmbeddingsParamsWithSign) {
    super(fields ?? {});

    this.tencentSecretId =
      fields?.tencentSecretId ?? getEnvironmentVariable("TENCENT_SECRET_ID");
    if (!this.tencentSecretId) {
      throw new Error("Tencent SecretID not found");
    }

    this.tencentSecretKey =
      fields?.tencentSecretKey ?? getEnvironmentVariable("TENCENT_SECRET_KEY");
    if (!this.tencentSecretKey) {
      throw new Error("Tencent SecretKey not found");
    }

    this.host = fields?.host ?? this.host;
    if (!fields?.sign) {
      throw new Error("Sign method undefined");
    }
    this.sign = fields?.sign;
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
  ): Promise<GetEmbeddingResponse> {
    const request = { Input: input };
    const timestamp = Math.trunc(Date.now() / 1000);
    const headers = {
      "Content-Type": "application/json",
      "X-TC-Action": "GetEmbedding",
      "X-TC-Version": "2023-09-01",
      "X-TC-Timestamp": timestamp.toString(),
      Authorization: "",
    };

    headers.Authorization = this.sign(
      this.host,
      request,
      timestamp,
      this.tencentSecretId ?? "",
      this.tencentSecretKey ?? "",
      headers
    );

    return this.caller.call(async () => {
      const response = await fetch(`https://${this.host}`, {
        headers,
        method: "POST",
        body: JSON.stringify(request),
      });

      if (response.ok) {
        return response.json();
      }

      throw new Error(
        `Error getting embeddings from Tencent Hunyuan. ${JSON.stringify(
          await response.json(),
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
    const { Response } = await this.embeddingWithRetry(text);
    if (Response?.Error?.Message) {
      throw new Error(`[${Response.RequestId}] ${Response.Error.Message}`);
    }
    return Response.Data[0].Embedding;
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
