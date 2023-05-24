import { Embeddings, EmbeddingsParams } from "./base.js";
import {
  GoogleVertexAIBasePrediction,
  GoogleVertexAIConnectionParams,
} from "../types/googlevertexai-types.js";
import { GoogleVertexAIConnection } from "../util/googlevertexai-connection.js";
import { AsyncCallerCallOptions } from "../util/async_caller.js";

export interface GoogleVertexAIEmbeddingsParams
  extends EmbeddingsParams,
    GoogleVertexAIConnectionParams {}

interface GoogleVertexAILLMEmbeddingsOptions extends AsyncCallerCallOptions {}

interface GoogleVertexAILLMEmbeddingsInstance {
  content: string;
}

interface EmbeddingsResults extends GoogleVertexAIBasePrediction {
  embeddings: {
    statistics: {
      token_count: number;
      truncated: boolean;
    };
    values: number[];
  };
}

export class GoogleVertexAIEmbeddings
  extends Embeddings
  implements GoogleVertexAIEmbeddingsParams
{
  model = "textembedding-gecko";

  private connection: GoogleVertexAIConnection<
    GoogleVertexAILLMEmbeddingsOptions,
    GoogleVertexAILLMEmbeddingsInstance,
    EmbeddingsResults
  >;

  constructor(fields?: GoogleVertexAIEmbeddingsParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;

    this.connection = new GoogleVertexAIConnection(
      { ...fields, ...this },
      this.caller
    );
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const instances: GoogleVertexAILLMEmbeddingsInstance[] = documents.map(
      (document) => ({
        content: document,
      })
    );
    const parameters = {};
    const options = {};
    const data = await this.connection.request(instances, parameters, options);
    const ret: number[][] = data.data.predictions.map(
      (result) => result.embeddings.values
    );
    return ret;
  }

  async embedQuery(document: string): Promise<number[]> {
    const data = await this.embedDocuments([document]);
    return data[0];
  }
}
