import { type ClientOptions } from "openai";
import { type BaseLLMParams } from "@langchain/core/language_models/llms";
import { OpenAI } from "../llms.js";
import type {
  OpenAIInput,
  AzureOpenAIInput,
  LegacyOpenAIInput,
} from "../types.js";

export class AzureOpenAI extends OpenAI {
  get lc_aliases(): Record<string, string> {
    return {
      openAIApiKey: "openai_api_key",
      openAIApiVersion: "openai_api_version",
      openAIBasePath: "openai_api_base",
    };
  }

  constructor(
    fields?: Partial<OpenAIInput> & {
      openAIApiKey?: string;
      openAIApiVersion?: string;
      openAIBasePath?: string;
      deploymentName?: string;
    } & Partial<AzureOpenAIInput> &
      BaseLLMParams & {
        configuration?: ClientOptions & LegacyOpenAIInput;
      }
  ) {
    // assume the base URL does not contain "openai" nor "deployments" prefix
    let basePath = fields?.openAIBasePath ?? "";
    if (!basePath.endsWith("/")) basePath += "/";
    if (!basePath.endsWith("openai/deployments"))
      basePath += "openai/deployments";

    const newFields = fields ? { ...fields } : fields;
    if (newFields) {
      newFields.azureOpenAIBasePath = basePath;
      newFields.azureOpenAIApiDeploymentName = newFields.deploymentName;
      newFields.azureOpenAIApiKey = newFields.openAIApiKey;
      newFields.azureOpenAIApiVersion = newFields.openAIApiVersion;
    }

    super(newFields);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    const json = super.toJSON() as unknown;

    function isRecord(obj: unknown): obj is Record<string, unknown> {
      return typeof obj === "object" && obj != null;
    }

    if (isRecord(json) && isRecord(json.kwargs)) {
      delete json.kwargs.azure_openai_base_path;
      delete json.kwargs.azure_openai_api_deployment_name;
      delete json.kwargs.azure_openai_api_key;
      delete json.kwargs.azure_openai_api_version;
      delete json.kwargs.azure_open_ai_base_path;
    }

    return json;
  }
}
