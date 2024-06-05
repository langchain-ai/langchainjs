import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export const DEEPINFRA_API_BASE =
  "https://api.deepinfra.com/v1/openai/completions";

export const DEFAULT_MODEL_NAME = "mistralai/Mixtral-8x22B-Instruct-v0.1";

export const ENV_VARIABLE = "DEEPINFRA_API_TOKEN";

export interface DeepInfraLLMParams extends BaseLLMParams {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class DeepInfraLLM extends LLM implements DeepInfraLLMParams {
  static lc_name() {
    return "DeepInfraLLM";
  }

  lc_serializable = true;

  apiKey?: string;

  model?: string;

  maxTokens?: number;

  temperature?: number;

  constructor(fields: Partial<DeepInfraLLMParams> = {}) {
    super(fields);

    this.apiKey = fields.apiKey ?? getEnvironmentVariable(ENV_VARIABLE);
    this.model = fields.model ?? DEFAULT_MODEL_NAME;
    this.maxTokens = fields.maxTokens;
    this.temperature = fields.temperature;
  }

  _llmType(): string {
    return "DeepInfra";
  }

  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const body = {
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      ...options,
      prompt,
      model: this.model,
    };
    const response = await this.caller.call(() =>
      fetch(DEEPINFRA_API_BASE, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }).then((res) => res.json())
    );
    return response as string;
  }
}
