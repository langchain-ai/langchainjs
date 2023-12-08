import { AI, environment } from "@raycast/api";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";

/**
 * The input parameters for the RaycastAI class, which extends the BaseLLMParams interface.
 */
export interface RaycastAIInput extends BaseLLMParams {
  model?: AI.Model;
  creativity?: number;
  rateLimitPerMinute?: number;
}

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * The RaycastAI class, which extends the LLM class and implements the RaycastAIInput interface.
 */
export class RaycastAI extends LLM implements RaycastAIInput {
  lc_serializable = true;

  /**
   * The model to use for generating text.
   */
  model: AI.Model;

  /**
   * The creativity parameter, also known as the "temperature".
   */
  creativity: number;

  /**
   * The rate limit for API calls, in requests per minute.
   */
  rateLimitPerMinute: number;

  /**
   * The timestamp of the last API call, used to enforce the rate limit.
   */
  private lastCallTimestamp = 0;

  /**
   * Creates a new instance of the RaycastAI class.
   * @param {RaycastAIInput} fields The input parameters for the RaycastAI class.
   * @throws {Error} If the Raycast AI environment is not accessible.
   */
  constructor(fields: RaycastAIInput) {
    super(fields ?? {});

    if (!environment.canAccess(AI)) {
      throw new Error("Raycast AI environment is not accessible.");
    }

    this.model = fields.model ?? "text-davinci-003";
    this.creativity = fields.creativity ?? 0.5;
    this.rateLimitPerMinute = fields.rateLimitPerMinute ?? 10;
  }

  /**
   * Returns the type of the LLM, which is "raycast_ai".
   * @return {string} The type of the LLM.
   * @ignore
   */
  _llmType() {
    return "raycast_ai";
  }

  /**
   * Calls AI.ask with the given prompt and returns the generated text.
   * @param {string} prompt The prompt to generate text from.
   * @return {Promise<string>} A Promise that resolves to the generated text.
   * @ignore
   */
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
