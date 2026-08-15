import { LangSmithParams } from "@langchain/core/language_models/chat_models";
import { Serialized } from "@langchain/core/load/serializable";
import {
  ChatOpenAICompletions,
  ChatOpenAICompletionsCallOptions,
} from "../../chat_models/completions.js";
import { AzureOpenAIChatInput, OpenAICoreRequestOptions } from "../../types.js";
import {
  _constructAzureFields,
  _getAzureClientOptions,
  _serializeAzureChat,
  AZURE_ALIASES,
  AZURE_SECRETS,
  AZURE_SERIALIZABLE_KEYS,
  AzureChatOpenAIFields,
  getAzureChatOpenAIInvocationParams,
  getAzureChatOpenAIParams,
  getAzureChatOpenAILsParams,
} from "./common.js";

export class AzureChatOpenAICompletions<
  CallOptions extends ChatOpenAICompletionsCallOptions =
    ChatOpenAICompletionsCallOptions,
>
  extends ChatOpenAICompletions<CallOptions>
  implements Partial<AzureOpenAIChatInput>
{
  azureOpenAIApiVersion?: string;

  azureOpenAIApiKey?: string;

  azureADTokenProvider?: () => Promise<string>;

  azureOpenAIApiInstanceName?: string;

  azureOpenAIApiDeploymentName?: string;

  azureOpenAIBasePath?: string;

  azureOpenAIEndpoint?: string;

  private readonly modelWasExplicitlyConfigured: boolean;

  _llmType(): string {
    return "azure_openai";
  }

  get lc_aliases(): Record<string, string> {
    return {
      ...super.lc_aliases,
      ...AZURE_ALIASES,
    };
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      ...super.lc_secrets,
      ...AZURE_SECRETS,
    };
  }

  get lc_serializable_keys(): string[] {
    return [...super.lc_serializable_keys, ...AZURE_SERIALIZABLE_KEYS];
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return getAzureChatOpenAILsParams(
      super.getLsParams(options),
      this.azureOpenAIApiDeploymentName,
      this.modelWasExplicitlyConfigured
    );
  }

  override invocationParams(
    options?: this["ParsedCallOptions"],
    extra?: { streaming?: boolean }
  ) {
    return getAzureChatOpenAIInvocationParams(
      super.invocationParams(options, extra),
      this.azureOpenAIApiDeploymentName,
      this.modelWasExplicitlyConfigured
    );
  }

  constructor(
    deploymentName: string,
    fields?: Omit<
      AzureChatOpenAIFields,
      "deploymentName" | "azureOpenAIApiDeploymentName" | "model"
    >
  );
  constructor(fields?: AzureChatOpenAIFields);
  constructor(
    deploymentOrFields?: string | AzureChatOpenAIFields,
    fieldsArg?: Omit<
      AzureChatOpenAIFields,
      "deploymentName" | "azureOpenAIApiDeploymentName" | "model"
    >
  ) {
    const fields = getAzureChatOpenAIParams(deploymentOrFields, fieldsArg);
    super(fields);
    this.modelWasExplicitlyConfigured = fields?.model != null;
    _constructAzureFields.call(this, fields);
  }

  override _getClientOptions(
    options: OpenAICoreRequestOptions | undefined
  ): OpenAICoreRequestOptions {
    return _getAzureClientOptions.call(this, options);
  }

  override toJSON(): Serialized {
    return _serializeAzureChat.call(this, super.toJSON());
  }
}
