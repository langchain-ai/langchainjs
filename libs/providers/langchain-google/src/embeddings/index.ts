import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { WebApiClient } from "../clients/index.js";
import {
  BaseGoogleEmbeddings,
  BaseGoogleEmbeddingsParams,
  getGoogleEmbeddingsParams,
} from "./base.js";

export interface GoogleEmbeddingsParams extends BaseGoogleEmbeddingsParams {
  apiKey?: string;
  authOptions?: never;
}

export class GoogleEmbeddings extends BaseGoogleEmbeddings {
  apiKey?: string;

  constructor(model: string, params?: Omit<GoogleEmbeddingsParams, "model">);
  constructor(params: GoogleEmbeddingsParams);
  constructor(
    modelOrParams: string | GoogleEmbeddingsParams,
    paramsArg?: Omit<GoogleEmbeddingsParams, "model">
  ) {
    const params = getGoogleEmbeddingsParams(modelOrParams, paramsArg);
    params.apiKey = params?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    const apiClient = params?.apiClient ?? new WebApiClient(params);
    super({ ...params, apiClient });

    this.apiKey = params.apiKey;
  }
}
