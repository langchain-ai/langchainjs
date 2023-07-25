import { Embeddings, EmbeddingsParams } from "../../embeddings/base.js";
import {
  GoogleVertexAIBasePrediction,
  GoogleVertexAIConnectionParams,
  GoogleVertexAILLMResponse,
} from "../../types/googlevertexai-types.js";
import { GoogleVertexAIConnection } from "../../util/googlevertexai-connection.js";
import { AsyncCallerCallOptions } from "../../util/async_caller.js";

export interface GoogleVertexAIMultimodalEmbeddingsParams
  extends EmbeddingsParams,
    GoogleVertexAIConnectionParams {}

interface GoogleVertexAIMultimodalEmbeddingsOptions
  extends AsyncCallerCallOptions {}

interface GoogleVertexAIMultimodalEmbeddingsInstance {
  text?: string;
  image?: {
    bytesBase64Encoded: string;
  };
}

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

export class GoogleVertexAIMultimodalEmbeddings
  extends Embeddings
  implements GoogleVertexAIMultimodalEmbeddingsParams
{
  model = "multimodalembedding@001";

  private connection: GoogleVertexAIConnection<
    GoogleVertexAIMultimodalEmbeddingsOptions,
    GoogleVertexAIMultimodalEmbeddingsInstance,
    GoogleVertexAIMultimodalEmbeddingsResults
  >;

  constructor(fields?: GoogleVertexAIMultimodalEmbeddingsParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;

    this.connection = new GoogleVertexAIConnection(
      { ...fields, ...this },
      this.caller
    );
  }

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

  responseToEmbeddings(
    response: GoogleVertexAILLMResponse<GoogleVertexAIMultimodalEmbeddingsResults>
  ): MediaEmbeddings[] {
    return response.data.predictions.map((r) => ({
      text: r.textEmbedding,
      image: r.imageEmbedding,
    }));
  }

  async embedMedia(media: GoogleVertexAIMedia[]): Promise<MediaEmbeddings[]> {
    // Only one media embedding request is allowed
    return Promise.all(media.map((m) => this.embedMediaQuery(m)));
  }

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

  async embedImage(images: Buffer[]): Promise<number[][]> {
    return this.embedMedia(images.map((image) => ({ image }))).then(
      (embeddings) => embeddings.map((e) => e.image ?? [])
    );
  }

  async embedImageQuery(image: Buffer): Promise<number[]> {
    return this.embedMediaQuery({
      image,
    }).then((embeddings) => embeddings.image ?? []);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this.embedMedia(documents.map((text) => ({ text }))).then(
      (embeddings) => embeddings.map((e) => e.text ?? [])
    );
  }

  async embedQuery(document: string): Promise<number[]> {
    return this.embedMediaQuery({
      text: document,
    }).then((embeddings) => embeddings.text ?? []);
  }
}
