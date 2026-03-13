import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
  SageMakerRuntimeClientConfig,
} from "@aws-sdk/client-sagemaker-runtime";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";

export interface SageMakerEndpointEmbeddingsParams extends EmbeddingsParams {
  /**
   * The name of the endpoint from the deployed SageMaker model. Must be unique
   * within an AWS Region.
   */
  endpointName: string;

  /**
   * Options passed to the SageMaker client.
   */
  clientOptions: SageMakerRuntimeClientConfig;
}

export class SageMakerEndpointEmbeddings extends Embeddings {
  endpointName: string;

  client: SageMakerRuntimeClient;

  constructor(fields: SageMakerEndpointEmbeddingsParams) {
    super(fields ?? {});

    const regionName = fields.clientOptions.region;
    if (!regionName) {
      throw new Error(
        `Please pass a "clientOptions" object with a "region" field to the constructor`
      );
    }

    const endpointName = fields?.endpointName;
    if (!endpointName) {
      throw new Error(`Please pass an "endpointName" field to the constructor`);
    }

    this.endpointName = fields.endpointName;
    this.client = new SageMakerRuntimeClient(fields.clientOptions);
  }

  protected async _embedText(text: string): Promise<number[]> {
    const inputBuffer = Buffer.from(
      JSON.stringify({
        inputs: [text],
      })
    );

    const response = await this.caller.call(() =>
      this.client.send(
        new InvokeEndpointCommand({
          Body: inputBuffer,
          EndpointName: this.endpointName,
          ContentType: "application/json",
        })
      )
    );

    return new TextDecoder().decode(response.Body) as unknown as number[];
  }

  embedQuery(document: string): Promise<number[]> {
    return this.caller.callWithOptions(
      {},
      this._embedText.bind(this),
      document
    );
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.all(documents.map((document) => this._embedText(document)));
  }
}
