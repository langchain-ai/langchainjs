import { AI, environment } from "@raycast/api";
import { LLM, BaseLLMParams } from "./base.js";

export type RaycastAIModel = "text-davinci-003" | "gpt-3.5-turbo";

export interface RaycastAIInput extends BaseLLMParams {
  model?: RaycastAIModel;
  creativity?: number;
  rateLimitPerMinute?: number;
}

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class RaycastAI extends LLM implements RaycastAIInput {
  model: RaycastAIModel;

  creativity: number;

  rateLimitPerMinute: number;

  private lastCallTimestamp = 0;

  constructor(fields: RaycastAIInput) {
    super(fields ?? {});

    if (!environment.canAccess(AI)) {
      throw new Error("Raycast AI environment is not accessible.");
    }

    this.model = fields.model ?? "text-davinci-003";
    this.creativity = fields.creativity ?? 0.5;
    this.rateLimitPerMinute = fields.rateLimitPerMinute ?? 10;
  }

  _llmType() {
    return "raycast_ai";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const response = await this.caller.call(async () => {
      // Rate limit calls to Raycast AI
      const now = Date.now();
      const timeSinceLastCall = now - this.lastCallTimestamp;
      const timeToWait =
        (60 / this.rateLimitPerMinute) * 1000 - timeSinceLastCall;

      if (timeToWait > 0) {
        await wait(timeToWait);
      }

      return await AI.ask(prompt, {
        model: this.model,
        creativity: this.creativity,
        signal: options.signal,
      });
    });

    // Since Raycast AI returns the response directly, no need for output transformation
    return response;
  }
}
