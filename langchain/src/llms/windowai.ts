import { LLM, BaseLLMParams } from "./base.js";

interface WindowAiInput extends BaseLLMParams {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  completionOptions?: object;
}

export class WindowAi extends LLM implements WindowAiInput {
  temperature = 0;
  maxTokens = 250;
  model: string;
  completionOptions: object;
  globalContext: any;

  constructor(fields?: WindowAiInput) {
    super(fields ?? {});

    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.model = fields?.model ?? this.model;
    this.completionOptions = fields?.completionOptions ?? {};

    this.globalContext = (typeof window !== "undefined") ? window : globalThis;

    this._ensureAiAvailable();
  }

  _llmType(): string {
    return "windowai";
  }

  async _call(prompt: string, stopSequences?: string[]): Promise<string> {
    const input = typeof prompt === "string" ? { prompt } : { messages: prompt };
    const options = {
      ...this.completionOptions,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      model: this.model,
      stopSequences,
    };

    try {
      const output = await this.globalContext.ai.getCompletion(input, options);
      return output.text;
    } catch (error) {
      console.log(error);
      throw new Error("Could not generate response from WindowAi.");
    }
  }

  async getCurrentModel(): Promise<string> {
    try {
      const modelID = await this.globalContext.ai.getCurrentModel();
      return modelID;
    } catch (error) {
      console.log(error);
      throw new Error("Could not retrieve current model from WindowAi.");
    }
  }

  private async _ensureAiAvailable(): Promise<void> {
    let timeoutCounter = 0;
    while (!this.globalContext.ai) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      timeoutCounter += 100;
      if (timeoutCounter >= 1000) {
        console.error("Please visit https://windowai.io to install WindowAi.");
        break;
      }
    }

    if (this.globalContext.ai) {
      console.log("WindowAi detected!");
    }
  }
}

