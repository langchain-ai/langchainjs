import { GoogleAuth, GoogleAuthOptions } from "google-auth-library";
import { Embeddings, EmbeddingsParams } from "../../embeddings/base.js";
import {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAILLMResponse,
} from "../../types/googlevertexai-types.js";
import { GoogleVertexAILLMConnection } from "../../util/googlevertexai-connection.js";
import { AsyncCallerCallOptions } from "../../util/async_caller.js";

/**
 * Parameters for the GoogleVertexAIMultimodalEmbeddings class, extending
 * both EmbeddingsParams and GoogleVertexAIConnectionParams.
 */
export interface GoogleVertexAIMultimodalEmbeddingsParams
  extends EmbeddingsParams,
    GoogleVertexAIBaseLLMInput<GoogleAuthOptions> {}

/**
 * Options for the GoogleVertexAIMultimodalEmbeddings class, extending
 * AsyncCallerCallOptions.
 */
interface GoogleVertexAIMultimodalEmbeddingsOptions
  extends AsyncCallerCallOptions {}

/**
 * An instance of media (text or image) that can be used for generating
 * embeddings.
 */
interface GoogleVertexAIMultimodalEmbeddingsInstance {
  text?: string;
  image?: {
    bytesBase64Encoded: string;
  };
}

/**
 * The results of generating embeddings, extending
 * GoogleVertexAIBasePrediction. It includes text and image embeddings.
 */
interface GoogleVertexAIMultimodalEmbeddingsResults
  extends GoogleVertexAIBasePrediction {
  textEmbedding?: number[];
  imageEmbedding?: number[];
}

/**
 * The media should have a text property, an image property, or both.
 */
export type GoogleVertexAIMedia =
  | {
      text: string;
      image?: Buffer;
    }
  | {
      text?: string;
      image: Buffer;
    };

export type MediaEmbeddings = {
  text?: number[];
  image?: number[];
};

/**
 * Class for generating embeddings for text and images using Google's
 * Vertex AI. It extends the Embeddings base class and implements the
 * GoogleVertexAIMultimodalEmbeddingsParams interface.
 */
export class GoogleVertexAIMultimodalEmbeddings
  extends Embeddings
  implements GoogleVertexAIMultimodalEmbeddingsParams
{
  model = "multimodalembedding@001";

  private connection: GoogleVertexAILLMConnection<
    GoogleVertexAIMultimodalEmbeddingsOptions,
    GoogleVertexAIMultimodalEmbeddingsInstance,
    GoogleVertexAIMultimodalEmbeddingsResults,
    GoogleAuthOptions
  >;

  constructor(fields?: GoogleVertexAIMultimodalEmbeddingsParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;

    this.connection = new GoogleVertexAILLMConnection(
      { ...fields, ...this },
      this.caller,
      new GoogleAuth({
        scopes: "https://www.googleapis.com/auth/cloud-platform",
        ...fields?.authOptions,
      })
    );
  }

  /**
   * Converts media (text or image) to an instance that can be used for
   * generating embeddings.
   * @param media The media (text or image) to be converted.
   * @returns An instance of media that can be used for generating embeddings.
   */
  mediaToInstance(
    media: GoogleVertexAIMedia
  ): GoogleVertexAIMultimodalEmbeddingsInstance {
    const ret: GoogleVertexAIMultimodalEmbeddingsInstance = {};

    if (media?.text) {
      ret.text = media.text;
    }

    if (media.image) {
      ret.image = {
        bytesBase64Encoded: media.image.toString("base64"),
      };
    }

    return ret;
  }

  /**
   * Converts the response from Google Vertex AI to embeddings.
   * @param response The response from Google Vertex AI.
   * @returns An array of media embeddings.
   */
  responseToEmbeddings(
    response: GoogleVertexAILLMResponse<GoogleVertexAIMultimodalEmbeddingsResults>
  ): MediaEmbeddings[] {
    return response.data.predictions.map((r) => ({
      text: r.textEmbedding,
      image: r.imageEmbedding,
    }));
  }

  /**
   * Generates embeddings for multiple media instances.
   * @param media An array of media instances.
   * @returns A promise that resolves to an array of media embeddings.
   */
  async embedMedia(media: GoogleVertexAIMedia[]): Promise<MediaEmbeddings[]> {
    // Only one media embedding request is allowed
    return Promise.all(media.map((m) => this.embedMediaQuery(m)));
  }

  /**
   * Generates embeddings for a single media instance.
   * @param media A single media instance.
   * @returns A promise that resolves to a media embedding.
   */
  async embedMediaQuery(media: GoogleVertexAIMedia): Promise<MediaEmbeddings> {
    const instance: GoogleVertexAIMultimodalEmbeddingsInstance =
      this.mediaToInstance(media);
    const instances = [instance];

    const parameters = {};
    const options = {};
    const responses = await this.connection.request(
      instances,
      parameters,
      options
    );

    const result = this.responseToEmbeddings(responses);
    return result[0];
  }

  /**
   * Generates embeddings for multiple images.
   * @param images An array of images.
   * @returns A promise that resolves to an array of image embeddings.
   */
  async embedImage(images: Buffer[]): Promise<number[][]> {
    return this.embedMedia(images.map((image) => ({ image }))).then(
      (embeddings) => embeddings.map((e) => e.image ?? [])
    );
  }

  /**
   * Generates embeddings for a single image.
   * @param image A single image.
   * @returns A promise that resolves to an image embedding.
   */
  async embedImageQuery(image: Buffer): Promise<number[]> {
    return this.embedMediaQuery({
      image,
    }).then((embeddings) => embeddings.image ?? []);
  }

  /**
   * Generates embeddings for multiple text documents.
   * @param documents An array of text documents.
   * @returns A promise that resolves to an array of text document embeddings.
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this.embedMedia(documents.map((text) => ({ text }))).then(
      (embeddings) => embeddings.map((e) => e.text ?? [])
    );
  }

  /**
   * Generates embeddings for a single text document.
   * @param document A single text document.
   * @returns A promise that resolves to a text document embedding.
   */
  async embedQuery(document: string): Promise<number[]> {
    return this.embedMediaQuery({
      text: document,
    }).then((embeddings) => embeddings.text ?? []);
  }
}
