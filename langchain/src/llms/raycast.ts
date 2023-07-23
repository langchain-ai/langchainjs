import { AI, environment } from "@raycast/api";
import { LLM, BaseLLMParams } from "./base.js";

export type RaycastAIModel = "text-davinci-003" | "gpt-3.5-turbo";

export interface RaycastAIInput extends BaseLLMParams {
  model?: RaycastAIModel;
  creativity?: number;
}

export class RaycastAI extends LLM implements RaycastAIInput {
  model: RaycastAIModel;

  creativity: number;

  constructor(fields: RaycastAIInput) {
    super(fields ?? {});

    if (!environment.canAccess(AI)) {
      throw new Error("Raycast AI environment is not accessible.");
    }

    this.model = fields.model ?? "text-davinci-003";
    this.creativity = fields.creativity ?? 0.5;
  }

  _llmType() {
    return "raycast_ai";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const response = await this.caller.call(() =>
      AI.ask(prompt, {
        model: this.model,
        creativity: this.creativity,
        signal: options.signal,
      })
    );

    // Since Raycast AI returns the response directly, no need for output transformation
    return response;
  }
}
