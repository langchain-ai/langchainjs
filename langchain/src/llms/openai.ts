import { OpenAI } from "@langchain/openai";

import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import type { LLMResult } from "../schema/index.js";
import { getEnvironmentVariable } from "../util/env.js";
import { promptLayerTrackRequest } from "../util/prompt-layer.js";

export {
  type AzureOpenAIInput,
  type OpenAICallOptions,
  type OpenAIInput,
} from "@langchain/openai";

export { OpenAI };

/**
 * PromptLayer wrapper to OpenAI
 * @augments OpenAI
 */
export class PromptLayerOpenAI extends OpenAI {
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      promptLayerApiKey: "PROMPTLAYER_API_KEY",
    };
  }

  lc_serializable = false;

  promptLayerApiKey?: string;

  plTags?: string[];

  returnPromptLayerId?: boolean;

  constructor(
    fields?: ConstructorParameters<typeof OpenAI>[0] & {
      promptLayerApiKey?: string;
      plTags?: string[];
      returnPromptLayerId?: boolean;
    }
  ) {
    super(fields);

    this.plTags = fields?.plTags ?? [];
    this.promptLayerApiKey =
      fields?.promptLayerApiKey ??
      getEnvironmentVariable("PROMPTLAYER_API_KEY");

    this.returnPromptLayerId = fields?.returnPromptLayerId;
    if (!this.promptLayerApiKey) {
      throw new Error("Missing PromptLayer API key");
    }
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const requestStartTime = Date.now();
    const generations = await super._generate(prompts, options, runManager);

    for (let i = 0; i < generations.generations.length; i += 1) {
      const requestEndTime = Date.now();
      const parsedResp = {
        text: generations.generations[i][0].text,
        llm_output: generations.llmOutput,
      };

      const promptLayerRespBody = await promptLayerTrackRequest(
        this.caller,
        "langchain.PromptLayerOpenAI",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...this._identifyingParams(), prompt: prompts[i] } as any,
        this.plTags,
        parsedResp,
        requestStartTime,
        requestEndTime,
        this.promptLayerApiKey
      );

      let promptLayerRequestId;
      if (this.returnPromptLayerId === true) {
        if (promptLayerRespBody && promptLayerRespBody.success === true) {
          promptLayerRequestId = promptLayerRespBody.request_id;
        }

        generations.generations[i][0].generationInfo = {
          ...generations.generations[i][0].generationInfo,
          promptLayerRequestId,
        };
      }
    }

    return generations;
  }
}

export { OpenAIChat, PromptLayerOpenAIChat } from "./openai-chat.js";
