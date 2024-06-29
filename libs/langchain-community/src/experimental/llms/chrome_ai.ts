import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import {
  CallbackManagerForLLMRun,
} from "@langchain/core/callbacks/manager";
import { GenerationChunk } from "@langchain/core/outputs";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { BaseLLMParams, LLM } from "@langchain/core/language_models/llms";

export interface AI {
  canCreateTextSession(): Promise<AIModelAvailability>;
  createTextSession(options?: AITextSessionOptions): Promise<AITextSession>;
  defaultTextSessionOptions(): Promise<AITextSessionOptions>;
}

export interface AITextSession {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): ReadableStream;
  destroy(): void;
  clone(): AITextSession;
}

export interface AITextSessionOptions {
  topK: number;
  temperature: number;
}

export type AIModelAvailability = "readily" | "after-download" | "no";

export interface ChromeAIInputs extends BaseLLMParams {
  topK?: number;
  temperature?: number;
}

export interface ChromeAICallOptions extends BaseLanguageModelCallOptions {}

/**
 * To use this model you need to have the `Built-in AI Early Preview Program`
 * for Chrome. You can find more information about the program here:
 * @link https://developer.chrome.com/docs/ai/built-in
 *
 * @example
 * ```typescript
 * // Initialize the ChatChromeAI model.
 * const model = new ChatChromeAI({
 *   temperature: 0.5, // Optional. Default is 0.5.
 *   topK: 40, // Optional. Default is 40.
 * });
 *
 * // Call the model with a message and await the response.
 * const response = await model.invoke([
 *   new HumanMessage({ content: "My name is John." }),
 * ]);
 * ```
 */
export class ChatChromeAI extends LLM<ChromeAICallOptions> {
  session?: AITextSession;

  temperature = 0.5;

  topK = 40;

  static lc_name() {
    return "ChatChromeAI";
  }

  constructor(inputs?: ChromeAIInputs) {
    super({
      ...inputs,
    });
    this.temperature = inputs?.temperature ?? this.temperature;
    this.topK = inputs?.topK ?? this.topK;
  }

  _llmType() {
    return "chrome_ai";
  }

  /**
   * Initialize the model. This method must be called before calling `.invoke()`.
   */
  async initialize() {
    if (typeof window === "undefined") {
      throw new Error("ChatChromeAI can only be used in the browser.");
    }

    const { ai } = window as any;
    const canCreateTextSession: AIModelAvailability = await ai.canCreateTextSession();
    if (canCreateTextSession === "no") {
      throw new Error("The AI model is not available.");
    } else if (canCreateTextSession === "after-download") {
      throw new Error("The AI model is not yet downloaded.");
    }

    this.session = await ai.createTextSession({
      topK: this.topK,
      temperature: this.temperature,
    });
  }

  /**
   * Call `.destroy()` to free resources if you no longer need a session.
   * When a session is destroyed, it can no longer be used, and any ongoing
   * execution will be aborted. You may want to keep the session around if
   * you intend to prompt the model often since creating a session can take
   * some time.
   */
  destroy() {
    if (!this.session) {
      return console.log("No session found. Returning.");
    }
    this.session.destroy();
  }

  async *_streamResponseChunks(
    prompt: string,
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    if (!this.session) {
      await this.initialize();
    }

    const stream = this.session!.promptStreaming(prompt);
    const iterableStream = IterableReadableStream.fromReadableStream(stream);

    let previousContent = "";
    for await (const chunk of iterableStream) {
      const newContent = chunk.slice(previousContent.length);
      previousContent += newContent;
      yield new GenerationChunk({
        text: newContent,
      });
      await runManager?.handleLLMNewToken(newContent);
    }
  }

  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const chunks = [];
    for await (const chunk of this._streamResponseChunks(
      prompt,
      options,
      runManager
    )) {
      chunks.push(chunk.text);
    }
    return chunks.join("");
  }
}
