import {
  Configuration,
  OpenAIApi,
  ConfigurationParameters,
  CreateModerationRequest,
  CreateModerationResponseResultsInner,
} from "openai";
import { BaseChain, ChainInputs } from "./base.js";
import { ChainValues } from "../schema/index.js";

export interface ModerationChainInput extends ChainInputs {
  openAIApiKey?: string;
  openAIOrganization?: string;
}

export class OpenAIModerationChain
  extends BaseChain
  implements ModerationChainInput
{
  inputKey = "input";

  outputKey = "output";

  openAIApiKey?: string;

  openAIOrganization?: string;

  clientConfig: Configuration;

  client: OpenAIApi;

  throwError: boolean;

  constructor(
    fields?: ModerationChainInput,
    configuration?: ConfigurationParameters,
    throwError = false
  ) {
    super(fields);
    this.throwError = throwError;
    this.openAIApiKey =
      fields?.openAIApiKey ??
      // eslint-disable-next-line no-process-env
      (typeof process !== "undefined" ? process.env.OPENAI_API_KEY : undefined);

    if (!this.openAIApiKey) {
      throw new Error("OpenAI API key not found");
    }

    this.openAIOrganization =
      fields?.openAIOrganization ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env.OPENAI_ORGANIZATION
        : undefined);

    this.clientConfig = new Configuration({
      ...configuration,
      apiKey: this.openAIApiKey,
      organization: this.openAIOrganization,
    });

    this.client = new OpenAIApi(this.clientConfig);
  }

  _moderate(
    text: string,
    results: CreateModerationResponseResultsInner
  ): string {
    if (results.flagged) {
      const errorStr = "Text was found that violates OpenAI's content policy.";
      if (this.throwError) {
        throw new Error(errorStr);
      } else {
        return errorStr;
      }
    }
    return text;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    console.log(values);
    const text = values[this.inputKey];
    const moderationRequest: CreateModerationRequest = {
      input: text,
    };
    let mod;
    try {
      mod = await this.client.createModeration(moderationRequest);
    } catch (error) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(error as string);
      }
    }
    const output = this._moderate(text, mod.data.results[0]);
    return {
      [this.outputKey]: output,
    };
  }

  _chainType() {
    return "moderation_chain";
  }

  get inputKeys(): string[] {
    return [this.inputKey];
  }

  get outputKeys(): string[] {
    return [this.outputKey];
  }
}
