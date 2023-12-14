import { type ClientOptions } from "openai";
import { type BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "../chat_models.js";
import {
  AzureOpenAIInput,
  LegacyOpenAIInput,
  OpenAIChatInput,
} from "../types.js";

export class AzureChatOpenAI extends ChatOpenAI {
  _llmType(): string {
    return "azure_openai";
  }

  get lc_aliases(): Record<string, string> {
    return {
      openAIApiKey: "openai_api_key",
      openAIApiVersion: "openai_api_version",
      openAIBasePath: "openai_api_base",
    };
  }

  constructor(
    fields?: Partial<OpenAIChatInput> &
      Partial<AzureOpenAIInput> & {
        openAIApiKey?: string;
        openAIApiVersion?: string;
        openAIBasePath?: string;
        deploymentName?: string;
      } & BaseChatModelParams & {
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
