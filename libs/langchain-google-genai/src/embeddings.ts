import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import type { TaskType, EmbedContentRequest } from "@google/generative-ai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the GoogleGenerativeAIEmbeddings class.
 */
export interface GoogleGenerativeAIEmbeddingsParams extends EmbeddingsParams {
  /**
   * Model Name to use
   *
   * Note: The format must follow the pattern - `{model}`
   */
  modelName?: string;

  /**
   * Type of task for which the embedding will be used
   *
   * Note: currently only supported by `embedding-001` model
   */
  taskType?: TaskType;

  /**
   * An optional title for the text. Only applicable when TaskType is
   * `RETRIEVAL_DOCUMENT`
   *
   * Note: currently only supported by `embedding-001` model
   */
  title?: string;

  /**
   * Whether to strip new lines from the input text. Default to true
   */
  stripNewLines?: boolean;

  /**
   * Google API key to use
   */
  apiKey?: string;
}

/**
 * Class that extends the Embeddings class and provides methods for
 * generating embeddings using the Google Palm API.
 * @example
 * ```typescript
 * const model = new GoogleGenerativeAIEmbeddings({
 *   apiKey: "<YOUR API KEY>",
 *   modelName: "embedding-001",
 * });
 *
 * // Embed a single query
 * const res = await model.embedQuery(
 *   "What would be a good company name for a company that makes colorful socks?"
 * );
 * console.log({ res });
 *
 * // Embed multiple documents
 * const documentRes = await model.embedDocuments(["Hello world", "Bye bye"]);
 * console.log({ documentRes });
 * ```
 */
export class GoogleGenerativeAIEmbeddings
  extends Embeddings
  implements GoogleGenerativeAIEmbeddingsParams
{
  apiKey?: string;

  modelName = "embedding-001";

  taskType?: TaskType;

  title?: string;

  stripNewLines = true;

  private client: GenerativeModel;

  constructor(fields?: GoogleGenerativeAIEmbeddingsParams) {
    super(fields ?? {});

    this.modelName =
      fields?.modelName?.replace(/^models\//, "") ?? this.modelName;

    this.taskType = fields?.taskType ?? this.taskType;

    this.title = fields?.title ?? this.title;

    if (this.title && this.taskType !== "RETRIEVAL_DOCUMENT") {
      throw new Error(
        "title can only be sepcified with TaskType.RETRIEVAL_DOCUMENT"
      );
    }

    this.apiKey = fields?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    if (!this.apiKey) {
      throw new Error(
        "Please set an API key for Google GenerativeAI " +
          "in the environmentb variable GOOGLE_API_KEY " +
          "or in the `apiKey` field of the " +
          "GoogleGenerativeAIEmbeddings constructor"
      );
    }

    this.client = new GoogleGenerativeAI(this.apiKey).getGenerativeModel({
      model: this.modelName,
    });
  }

  private _convertToContent(text: string): EmbedContentRequest {
    const cleanedText = this.stripNewLines ? text.replace(/\n/g, " ") : text;
    return {
      content: { role: "user", parts: [{ text: cleanedText }] },
      taskType: this.taskType,
      title: this.title,
    };
  }

  protected async _embedQueryContent(text: string): Promise<number[]> {
    const req = this._convertToContent(text);
    const res = await this.client.embedContent(req);
    return res.embedding.values ?? [];
  }

  protected async _embedDocumentsContent(
    documents: string[]
  ): Promise<number[][]> {
    const req = {
      requests: documents.map((doc) => this._convertToContent(doc)),
    };
    const res = await this.client.batchEmbedContents(req);
    return res.embeddings.map((e) => e.values || []) ?? [];
  }

  /**
   * Method that takes a document as input and returns a promise that
   * resolves to an embedding for the document. It calls the _embedText
   * method with the document as the input.
   * @param document Document for which to generate an embedding.
   * @returns Promise that resolves to an embedding for the input document.
   */
  embedQuery(document: string): Promise<number[]> {
    return this.caller.call(this._embedQueryContent.bind(this), document);
  }

  /**
   * Method that takes an array of documents as input and returns a promise
   * that resolves to a 2D array of embeddings for each document. It calls
   * the _embedText method for each document in the array.
   * @param documents Array of documents for which to generate embeddings.
   * @returns Promise that resolves to a 2D array of embeddings for each input document.
   */
  embedDocuments(documents: string[]): Promise<number[][]> {
    return this.caller.call(this._embedDocumentsContent.bind(this), documents);
  }
}
