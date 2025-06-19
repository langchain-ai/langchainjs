import {
  GoogleAbstractedClient,
  GoogleBaseLLM,
  GoogleBaseLLMInput,
} from "@langchain/google-common";
import { Environment, GoogleAuthOptions, environment } from "./environment.js";

/**
 * Input to LLM class.
 */
export interface GoogleLLMInput<Env extends Environment>
  extends GoogleBaseLLMInput<GoogleAuthOptions<Env>> {}

/**
 * Integration with a Google LLM.
 */
export class GoogleLLM<Env extends Environment>
  extends GoogleBaseLLM<GoogleAuthOptions<Env>>
  implements GoogleLLMInput<Env>
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "GoogleLLM";
  }

  lc_serializable = true;

  constructor(fields?: GoogleLLMInput<Env>) {
    super(fields);
  }

  buildAbstractedClient(
    fields: GoogleBaseLLMInput<GoogleAuthOptions<Env>> | undefined
  ): GoogleAbstractedClient {
    return new environment.value.GoogleAuth(fields);
  }
}

/**
 * Integration with a Google Vertex AI LLM using
 * the "@langchain/google-gauth" package for auth.
 */
export class VertexAI<Env extends Environment> extends GoogleLLM<Env> {
  lc_namespace = ["langchain", "llms", "vertexai"];

  static lc_name() {
    return "VertexAI";
  }

  constructor(fields?: GoogleLLMInput<Env>) {
    super({
      ...fields,
      platformType: "gcp",
    });
  }
}
