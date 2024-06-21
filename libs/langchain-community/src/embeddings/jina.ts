import { existsSync, readFileSync } from "fs";
import { parse } from "url";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * The default Jina API URL for embedding requests.
 */
const JINA_API_URL: string = "https://api.jina.ai/v1/embeddings";

/**
 * Check if a URL is a local file.
 * @param url - The URL to check.
 * @returns True if the URL is a local file, False otherwise.
 */
function isLocal(url: string): boolean {
  const urlParsed = parse(url);
  if (urlParsed.protocol === null || urlParsed.protocol === "file:") {
    return existsSync(urlParsed.pathname || "");
  }
  return false;
}

/**
 * Get the bytes string of a file.
 * @param filePath - The path to the file.
 * @returns The bytes string of the file.
 */
function getBytesStr(filePath: string): string {
  const imageFile = readFileSync(filePath);
  return Buffer.from(imageFile).toString("base64");
}

export interface JinaEmbeddingsParams extends EmbeddingsParams {
  apiKey?: string;
  modelName?: string;
}

export interface JinaEmbeddingsResponse {
  data: { index: number; embedding: number[] }[];
  detail?: string;
}

export class JinaEmbeddings extends Embeddings implements JinaEmbeddingsParams {
  apiKey: string;
  modelName: string;

  constructor(fields?: Partial<JinaEmbeddingsParams> & { verbose?: boolean }) {
    const fieldsWithDefaults = {
      modelName: "jina-embeddings-v2-base-en",
      ...fields,
    };
    super(fieldsWithDefaults);

    const apiKey = fieldsWithDefaults?.apiKey || getEnvironmentVariable("JINA_API_KEY") || getEnvironmentVariable("JINA_AUTH_TOKEN");

    if (!apiKey) {
      throw new Error("Jina API key not found");
    }

    this.modelName = fieldsWithDefaults?.modelName ?? this.modelName;
    this.apiKey = apiKey;
  }

  /**
   * Generates embeddings for an array of inputs.
   * @param input - An array of strings or objects to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  private async _embed(input: any): Promise<number[][]> {
    const response = await fetch(JINA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input, model: this.modelName }),
    });

    const json = (await response.json()) as JinaEmbeddingsResponse;

    if (!json.data) {
      throw new Error(json.detail || "Unknown error from Jina API");
    }

    const sortedEmbeddings = json.data.sort((a, b) => a.index - b.index);

    return sortedEmbeddings.map((item) => item.embedding);
  }

  /**
   * Generates embeddings for an array of texts.
   * @param texts - An array of strings to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this._embed(texts);
  }

  /**
   * Generates an embedding for a single text.
   * @param text - A string to generate an embedding for.
   * @returns A Promise that resolves to an array of numbers representing the embedding.
   */
  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this._embed([text]);
    return embeddings[0];
  }

  /**
   * Generates embeddings for an array of image URIs.
   * @param uris - An array of image URIs to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  async embedImages(uris: string[]): Promise<number[][]> {
    const input = uris.map((uri) => (isLocal(uri) ? { bytes: getBytesStr(uri) } : { url: uri }));
    return this._embed(input);
  }
}
