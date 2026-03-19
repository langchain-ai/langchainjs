import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  ChatOpenAICallOptions,
  ChatOpenAICompletions,
  ChatOpenAIFields,
} from "@langchain/openai";

export interface ChatIOIntelligenceCallOptions
  extends ChatOpenAICallOptions {
  headers?: Record<string, string>;
}

export interface ChatIOIntelligenceInput extends ChatOpenAIFields {
  /**
   * The IO Intelligence API key to use for requests.
   * @default process.env.IO_INTELLIGENCE_API_KEY
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   */
  model?: string;
  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   * Alias for `stopSequences`
   */
  stop?: Array<string>;
  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   */
  stopSequences?: Array<string>;
  /**
   * Whether or not to stream responses.
   */
  streaming?: boolean;
  /**
   * The temperature to use for sampling.
   */
  temperature?: number;
  /**
   * The maximum number of tokens that the model can process in a single response.
   * This limits ensures computational efficiency and resource management.
   */
  maxTokens?: number;
}

/**
 * IO Intelligence chat model integration.
 *
 * IO Intelligence provides an OpenAI-compatible API for accessing a wide
 * range of open-source and proprietary models through decentralized GPU
 * infrastructure.
 *
 * Setup:
 * Install `@langchain/iointelligence` and set an environment variable named `IO_INTELLIGENCE_API_KEY`.
 *
 * ```bash
 * npm install @langchain/iointelligence
 * export IO_INTELLIGENCE_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/_langchain_iointelligence.ChatIOIntelligence.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/_langchain_iointelligence.ChatIOIntelligenceCallOptions.html)
 *
 * Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
 * They can also be passed via `.withConfig`, or the second arg in `.bindTools`, like shown in the examples below:
 *
 * ```typescript
 * // When calling `.withConfig`, call options should be passed via the first argument
 * const llmWithArgsBound = llm.withConfig({
 *   stop: ["\n"],
 *   tools: [...],
 * });
 *
 * // When calling `.bindTools`, call options should be passed via the second argument
 * const llmWithTools = llm.bindTools(
 *   [...],
 *   {
 *     tool_choice: "auto",
 *   }
 * );
 * ```
 *
 * ## Examples
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { ChatIOIntelligence } from '@langchain/iointelligence';
 *
 * const llm = new ChatIOIntelligence({
 *   model: "meta-llama/Llama-3.3-70B-Instruct",
 *   temperature: 0,
 *   // other params...
 * });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Invoking</strong></summary>
 *
 * ```typescript
 * const input = `Translate "I love programming" into French.`;
 *
 * // Models also accept a list of chat messages or a formatted prompt
 * const result = await llm.invoke(input);
 * console.log(result);
 * ```
 *
 * ```txt
 * AIMessage {
 *   "content": "The French translation of \"I love programming\" is \"J'adore la programmation\".",
 *   "response_metadata": {
 *     "tokenUsage": {
 *       "completionTokens": 18,
 *       "promptTokens": 14,
 *       "totalTokens": 32
 *     },
 *     "finish_reason": "stop"
 *   },
 *   "tool_calls": [],
 *   "invalid_tool_calls": []
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Streaming Chunks</strong></summary>
 *
 * ```typescript
 * for await (const chunk of await llm.stream(input)) {
 *   console.log(chunk);
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Bind tools</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const GetWeather = {
 *   name: "GetWeather",
 *   description: "Get the current weather in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const GetPopulation = {
 *   name: "GetPopulation",
 *   description: "Get the current population in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const llmWithTools = llm.bindTools([GetWeather, GetPopulation]);
 * const aiMsg = await llmWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?"
 * );
 * console.log(aiMsg.tool_calls);
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Structured Output</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const Joke = z.object({
 *   setup: z.string().describe("The setup of the joke"),
 *   punchline: z.string().describe("The punchline to the joke"),
 *   rating: z.number().optional().describe("How funny the joke is, from 1 to 10")
 * }).describe('Joke to tell user.');
 *
 * const structuredLlm = llm.withStructuredOutput(Joke, { name: "Joke" });
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 * </details>
 *
 * <br />
 */
export class ChatIOIntelligence extends ChatOpenAICompletions<ChatIOIntelligenceCallOptions> {
  static lc_name() {
    return "ChatIOIntelligence";
  }

  _llmType() {
    return "iointelligence";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "IO_INTELLIGENCE_API_KEY",
    };
  }

  lc_serializable = true;

  lc_namespace = ["langchain", "chat_models", "iointelligence"];

  constructor(model: string, fields?: Omit<ChatIOIntelligenceInput, "model">);
  constructor(fields?: Partial<ChatIOIntelligenceInput>);
  constructor(
    modelOrFields?: string | Partial<ChatIOIntelligenceInput>,
    fieldsArg?: Omit<ChatIOIntelligenceInput, "model">
  ) {
    const fields =
      typeof modelOrFields === "string"
        ? { ...(fieldsArg ?? {}), model: modelOrFields }
        : (modelOrFields ?? {});
    const apiKey =
      fields.apiKey || getEnvironmentVariable("IO_INTELLIGENCE_API_KEY");
    if (!apiKey) {
      throw new Error(
        `IO Intelligence API key not found. Please set the IO_INTELLIGENCE_API_KEY environment variable or pass the key into "apiKey" field.`
      );
    }

    super({
      ...fields,
      apiKey,
      configuration: {
        baseURL: "https://api.intelligence.io.solutions/api/v1",
        ...fields.configuration,
      },
    });
    this._addVersion("@langchain/iointelligence", __PKG_VERSION__);
  }
}
