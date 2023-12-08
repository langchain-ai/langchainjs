import _ from "lodash";
import { LLMOptions, Portkey as _Portkey } from "portkey-ai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { GenerationChunk, LLMResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { BaseLLM } from "@langchain/core/language_models/llms";

interface PortkeyOptions {
  apiKey?: string;
  baseURL?: string;
  mode?: string;
  llms?: [LLMOptions] | null;
}

const readEnv = (env: string, default_val?: string): string | undefined =>
  getEnvironmentVariable(env) ?? default_val;

export class PortkeySession {
  portkey: _Portkey;

  constructor(options: PortkeyOptions = {}) {
    if (!options.apiKey) {
      /* eslint-disable no-param-reassign */
      options.apiKey = readEnv("PORTKEY_API_KEY");
    }

    if (!options.baseURL) {
      /* eslint-disable no-param-reassign */
      options.baseURL = readEnv("PORTKEY_BASE_URL", "https://api.portkey.ai");
    }

    this.portkey = new _Portkey({});
    this.portkey.llms = [{}];
    if (!options.apiKey) {
      throw new Error("Set Portkey ApiKey in PORTKEY_API_KEY env variable");
    }

    this.portkey = new _Portkey(options);
  }
}

const defaultPortkeySession: {
  session: PortkeySession;
  options: PortkeyOptions;
}[] = [];

/**
 * Get a session for the Portkey API. If one already exists with the same options,
 * it will be returned. Otherwise, a new session will be created.
 * @param options
 * @returns
 */
export function getPortkeySession(options: PortkeyOptions = {}) {
  let session = defaultPortkeySession.find((session) =>
    _.isEqual(session.options, options)
  )?.session;

  if (!session) {
    session = new PortkeySession(options);
    defaultPortkeySession.push({ session, options });
  }
  return session;
}

/**
 * @example
 * ```typescript
 * const model = new Portkey({
 *   mode: "single",
 *   llms: [
 *     {
 *       provider: "openai",
 *       virtual_key: "open-ai-key-1234",
 *       model: "text-davinci-003",
 *       max_tokens: 2000,
 *     },
 *   ],
 * });
 *
 * // Stream the output of the model and process it
 * const res = await model.stream(
 *   "Question: Write a story about a king\nAnswer:"
 * );
 * for await (const i of res) {
 *   process.stdout.write(i);
 * }
 * ```
 */
export class Portkey extends BaseLLM {
  apiKey?: string = undefined;

  baseURL?: string = undefined;

  mode?: string = undefined;

  llms?: [LLMOptions] | null = undefined;

  session: PortkeySession;

  constructor(init?: Partial<Portkey>) {
    super(init ?? {});
    this.apiKey = init?.apiKey;

    this.baseURL = init?.baseURL;

    this.mode = init?.mode;

    this.llms = init?.llms;

    this.session = getPortkeySession({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      llms: this.llms,
      mode: this.mode,
    });
  }

  _llmType() {
    return "portkey";
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    _?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const choices = [];
    for (let i = 0; i < prompts.length; i += 1) {
      const response = await this.session.portkey.completions.create({
        prompt: prompts[i],
        ...options,
        stream: false,
      });
      choices.push(response.choices);
    }
    const generations = choices.map((promptChoices) =>
      promptChoices.map((choice) => ({
        text: choice.text ?? "",
        generationInfo: {
          finishReason: choice.finish_reason,
          logprobs: choice.logprobs,
        },
      }))
    );

    return {
      generations,
    };
  }

  async *_streamResponseChunks(
    input: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const response = await this.session.portkey.completions.create({
      prompt: input,
      ...options,
      stream: true,
    });
    for await (const data of response) {
      const choice = data?.choices[0];
      if (!choice) {
        continue;
      }
      const chunk = new GenerationChunk({
        text: choice.text ?? "",
        generationInfo: {
          finishReason: choice.finish_reason,
        },
      });
      yield chunk;
      void runManager?.handleLLMNewToken(chunk.text ?? "");
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }
}
