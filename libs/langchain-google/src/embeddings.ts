import {
  GoogleAbstractedClient,
  GoogleConnectionParams,
  BaseGoogleEmbeddings,
  BaseGoogleEmbeddingsParams,
} from "@langchain/google-common";
import {
  type GoogleAuthOptions,
  environment,
  Environment,
} from "./environment.js";

/**
 * Input to LLM class.
 */
export interface GoogleEmbeddingsInput<Env extends Environment>
  extends BaseGoogleEmbeddingsParams<GoogleAuthOptions<Env>> {}

/**
 * Integration with an Google embeddings model.
 */
export class GoogleEmbeddings<Env extends Environment>
  extends BaseGoogleEmbeddings<GoogleAuthOptions<Env>>
  implements GoogleEmbeddingsInput<Env>
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "GoogleEmbeddings";
  }

  lc_serializable = true;

  constructor(fields: GoogleEmbeddingsInput<Env>) {
    super(fields);
  }

  buildAbstractedClient(
    fields?: GoogleConnectionParams<GoogleAuthOptions<Env>>
  ): GoogleAbstractedClient {
    return new environment.value.GoogleAuth(fields);
  }
}

export interface GoogleVertexAIEmbeddingsInput<Env extends Environment>
  extends GoogleEmbeddingsInput<Env> {}

/**
 * Integration with a Google Vertex AI embeddings model using
 * the "@langchain/google-gauth" package for auth.
 */
export class VertexAIEmbeddings<
  Env extends Environment
> extends GoogleEmbeddings<Env> {
  static lc_name() {
    return "VertexAIEmbeddings";
  }

  constructor(fields: GoogleEmbeddingsInput<Env>) {
    super({
      ...fields,
      platformType: "gcp",
    });
  }
}
