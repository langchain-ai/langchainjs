import { type ClientOptions, OpenAIClient } from "@langchain/openai";
import { BaseChain, ChainInputs } from "./base.js";
import { ChainValues } from "../schema/index.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";
import { getEnvironmentVariable } from "../util/env.js";

/**
 * Interface for the input parameters of the OpenAIModerationChain class.
 */
export interface OpenAIModerationChainInput
  extends ChainInputs,
    AsyncCallerParams {
  openAIApiKey?: string;
  openAIOrganization?: string;
  throwError?: boolean;
  configuration?: ClientOptions;
}

/**
 * Class representing a chain for moderating text using the OpenAI
 * Moderation API. It extends the BaseChain class and implements the
 * OpenAIModerationChainInput interface.
 * @example
 * ```typescript
 * const moderation = new ChatOpenAIModerationChain({ throwError: true });
 *
 * const badString = "Bad naughty words from user";
 *
 * try {
 *   const { output: moderatedContent, results } = await moderation.call({
 *     input: badString,
 *   });
 *
 *   if (results[0].category_scores["harassment/threatening"] > 0.01) {
 *     throw new Error("Harassment detected!");
 *   }
 *
 *   const model = new OpenAI({ temperature: 0 });
 *   const promptTemplate = "Hello, how are you today {person}?";
 *   const prompt = new PromptTemplate({
 *     template: promptTemplate,
 *     inputVariables: ["person"],
 *   });
 *   const chain = new LLMChain({ llm: model, prompt });
 *   const response = await chain.call({ person: moderatedContent });
 *   console.log({ response });
 * } catch (error) {
 *   console.error("Naughty words detected!");
 * }
 * ```
 */
export class OpenAIModerationChain
  extends BaseChain
  implements OpenAIModerationChainInput
{
  static lc_name() {
    return "OpenAIModerationChain";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      openAIApiKey: "OPENAI_API_KEY",
    };
  }

  inputKey = "input";

  outputKey = "output";

  openAIApiKey?: string;

  openAIOrganization?: string;

  clientConfig: ClientOptions;

  client: OpenAIClient;

  throwError: boolean;

  caller: AsyncCaller;

  constructor(fields?: OpenAIModerationChainInput) {
    super(fields);
    this.throwError = fields?.throwError ?? false;
    this.openAIApiKey =
      fields?.openAIApiKey ?? getEnvironmentVariable("OPENAI_API_KEY");

    if (!this.openAIApiKey) {
      throw new Error("OpenAI API key not found");
    }

    this.openAIOrganization = fields?.openAIOrganization;

    this.clientConfig = {
      ...fields?.configuration,
      apiKey: this.openAIApiKey,
      organization: this.openAIOrganization,
    };

    this.client = new OpenAIClient(this.clientConfig);

    this.caller = new AsyncCaller(fields ?? {});
  }

  _moderate(text: string, results: OpenAIClient.Moderation): string {
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
    const text = values[this.inputKey];
    const moderationRequest: OpenAIClient.ModerationCreateParams = {
      input: text,
    };
    let mod;
    try {
      mod = await this.caller.call(() =>
        this.client.moderations.create(moderationRequest)
      );
    } catch (error) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(error as string);
      }
    }
    const output = this._moderate(text, mod.results[0]);
    return {
      [this.outputKey]: output,
      results: mod.results,
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
