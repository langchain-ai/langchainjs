/* eslint-disable no-restricted-globals */
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
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
  systemPrompt?: string;
}

export interface ChromeAICallOptions extends BaseLanguageModelCallOptions {}

/**
 * To use this model you need to have the `Built-in AI Early Preview Program`
 * for Chrome. You can find more information about the program here:
 * @link https://developer.chrome.com/docs/ai/built-in
 *
 * @example
 * ```typescript
 * // Initialize the ChromeAI model.
 * const model = new ChromeAI({
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
export class ChromeAI extends LLM<ChromeAICallOptions> {
  temperature?: number;

  topK?: number;

  systemPrompt?: string;

  static lc_name() {
    return "ChromeAI";
  }

  constructor(inputs?: ChromeAIInputs) {
    super({
      ...inputs,
    });
    this.temperature = inputs?.temperature ?? this.temperature;
    this.topK = inputs?.topK ?? this.topK;
    this.systemPrompt = inputs?.systemPrompt;
  }

  _llmType() {
    return "chrome_ai";
  }

  /**
   * Initialize the model. This method may be called before invoking the model
   * to set up a chat session in advance.
   */
  protected async createSession() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aiInstance: any;
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Experimental browser-only global
      aiInstance = ai;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      throw new Error(
        `Could not initialize ChromeAI instance. Make sure you are running a version of Chrome with the proper experimental flags enabled.\n\nError message: ${e.message}`
      );
    }
    const { available } = await aiInstance.assistant.capabilities();
    if (available === "no") {
      throw new Error("The AI model is not available.");
    } else if (available === "after-download") {
      throw new Error("The AI model is not yet downloaded.");
    }

    const session = await aiInstance.assistant.create({
      systemPrompt: this.systemPrompt,
      topK: this.topK,
      temperature: this.temperature,
    });

    return session;
  }

  async *_streamResponseChunks(
    prompt: string,
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    let session;
    try {
      session = await this.createSession();

      const stream = session.promptStreaming(prompt);
      const iterableStream =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        IterableReadableStream.fromReadableStream<any>(stream);

      let previousContent = "";
      for await (const chunk of iterableStream) {
        const newContent = chunk.slice(previousContent.length);
        previousContent += newContent;
        yield new GenerationChunk({
          text: newContent,
        });
        await runManager?.handleLLMNewToken(newContent);
      }
    } finally {
      session?.destroy();
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
