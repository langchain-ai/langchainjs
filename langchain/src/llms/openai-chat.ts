import { OpenAIChat } from "@langchain/openai";

import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import type { Generation, LLMResult } from "../schema/index.js";
import { getEnvironmentVariable } from "../util/env.js";
import { promptLayerTrackRequest } from "../util/prompt-layer.js";

export {
  type AzureOpenAIInput,
  type OpenAICallOptions,
  type OpenAIInput,
  type OpenAIChatCallOptions,
} from "@langchain/openai";

export { OpenAIChat };

/**
 * PromptLayer wrapper to OpenAIChat
 */
export class PromptLayerOpenAIChat extends OpenAIChat {
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
    fields?: ConstructorParameters<typeof OpenAIChat>[0] & {
      promptLayerApiKey?: string;
      plTags?: string[];
      returnPromptLayerId?: boolean;
    }
  ) {
    super(fields);

    this.plTags = fields?.plTags ?? [];
    this.returnPromptLayerId = fields?.returnPromptLayerId ?? false;
    this.promptLayerApiKey =
      fields?.promptLayerApiKey ??
      getEnvironmentVariable("PROMPTLAYER_API_KEY");

    if (!this.promptLayerApiKey) {
      throw new Error("Missing PromptLayer API key");
    }
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    let choice: Generation[];

    const generations: Generation[][] = await Promise.all(
      prompts.map(async (prompt) => {
        const requestStartTime = Date.now();
        const text = await this._call(prompt, options, runManager);
        const requestEndTime = Date.now();

        choice = [{ text }];

        const parsedResp = {
          text,
        };
        const promptLayerRespBody = await promptLayerTrackRequest(
          this.caller,
          "langchain.PromptLayerOpenAIChat",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { ...this._identifyingParams(), prompt } as any,
          this.plTags,
          parsedResp,
          requestStartTime,
          requestEndTime,
          this.promptLayerApiKey
        );

        if (
          this.returnPromptLayerId === true &&
          promptLayerRespBody.success === true
        ) {
          choice[0].generationInfo = {
            promptLayerRequestId: promptLayerRespBody.request_id,
          };
        }

        return choice;
      })
    );

    return { generations };
  }
}
