import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { JigsawStack } from "jigsawstack";

type JigsawStackType = ReturnType<typeof JigsawStack>;
export type PromptEngineInputParams = Omit<
  Parameters<JigsawStackType["prompt_engine"]["run_prompt_direct"]>["0"],
  "prompt"
>;

interface JigsawStackPromptEngineInput extends BaseLLMParams {
  apiKey?: string;
}

interface PromptEngineCallOptions
  extends BaseLanguageModelCallOptions,
    Partial<PromptEngineInputParams> {}

/**
 * Class representing JigsawStack Prompt Engine. It interacts
 * with the JigsawStack API to generate text completions.
 * @example
 * ```typescript
 * const model = new JigsawStackPromptEngine();
 *
 * const res = await model.invoke(
 *   "Question: Tell me about the leaning tower of pisa?\nAnswer:"
 * );
 * console.log({ res });
 * ```
 */
export class JigsawStackPromptEngine
  extends LLM<PromptEngineCallOptions>
  implements JigsawStackPromptEngineInput
{
  static lc_name() {
    return "JigsawStackPromptEngine";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "JIGSAWSTACK_API_KEY",
      api_key: "JIGSAWSTACK_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "jigsawstack_api_key",
      api_key: "jigsawstack_api_key",
    };
  }

  lc_serializable = true;

  apiKey: string;

  client: JigsawStackType;

  constructor(fields?: JigsawStackPromptEngineInput) {
    super(fields ?? {});

    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("JIGSAWSTACK_API_KEY");

    if (!apiKey) {
      throw new Error(
        "Please set the JIGSAWSTACK_API_KEY environment variable or pass it to the constructor as the apiKey field."
      );
    }

    this.client = JigsawStack({
      apiKey,
    });
  }

  _llmType() {
    return "jigsawstack";
  }

  invocationParams(options: this["ParsedCallOptions"]) {
    const params = {
      inputs: options.inputs,
      return_prompt: options.return_prompt,
    };
    // Filter undefined entries
    return Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined)
    );
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const generateResponse = await this.caller.callWithOptions(
      { signal: options.signal },
      async () => {
        return await this.client.prompt_engine.run_prompt_direct({
          prompt,
          ...this.invocationParams(options),
        });
      }
    );
    try {
      await runManager?.handleLLMNewToken(generateResponse.result);
      return generateResponse.result;
    } catch {
      //   console.log(generateResponse);
      throw new Error("Could not parse response.");
    }
  }
}
