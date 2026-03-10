import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import { BaseMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { InteropZodType } from "@langchain/core/utils/types";
import { SerializableSchema } from "@langchain/core/utils/standard_schema";
import {
  ChatOpenAICallOptions,
  ChatOpenAICompletions,
  ChatOpenAIFields,
} from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Call options for the Infomaniak chat model.
 */
export interface ChatInfomaniakCallOptions extends ChatOpenAICallOptions {
  headers?: Record<string, string>;
}

/**
 * Input parameters for the Infomaniak chat model.
 */
export interface ChatInfomaniakInput extends ChatOpenAIFields {
  /**
   * The Infomaniak API key (Bearer token) to use for requests.
   * @default process.env.INFOMANIAK_API_KEY
   */
  apiKey?: string;
  /**
   * The Infomaniak AI product ID.
   * @default process.env.INFOMANIAK_PRODUCT_ID
   */
  productId?: string;
  /**
   * The name of the model to use.
   * @default "qwen3"
   */
  model?: string;
  /**
   * Up to 4 sequences where the API will stop generating further tokens.
   * Alias for `stopSequences`
   */
  stop?: Array<string>;
  /**
   * Up to 4 sequences where the API will stop generating further tokens.
   */
  stopSequences?: Array<string>;
  /**
   * Whether or not to stream responses.
   */
  streaming?: boolean;
  /**
   * The temperature to use for sampling (0-2).
   */
  temperature?: number;
  /**
   * The maximum number of tokens that the model can generate in a response.
   */
  maxTokens?: number;
}

/**
 * Infomaniak chat model integration.
 *
 * The Infomaniak AI API is OpenAI-compatible, allowing tool calling,
 * structured output, and streaming.
 *
 * Setup:
 * Install `@langchain/infomaniak` and set environment variables.
 *
 * ```bash
 * npm install @langchain/infomaniak
 * export INFOMANIAK_API_KEY="your-api-token"
 * export INFOMANIAK_PRODUCT_ID="your-product-id"
 * ```
 *
 * ## Examples
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { ChatInfomaniak } from "@langchain/infomaniak";
 *
 * const llm = new ChatInfomaniak({
 *   model: "qwen3",
 *   temperature: 0,
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
 * const result = await llm.invoke("What is the capital of France?");
 * console.log(result.content);
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Streaming</strong></summary>
 *
 * ```typescript
 * for await (const chunk of await llm.stream("Tell me a story")) {
 *   process.stdout.write(chunk.content as string);
 * }
 * ```
 * </details>
 */
export class ChatInfomaniak extends ChatOpenAICompletions<ChatInfomaniakCallOptions> {
  static lc_name() {
    return "ChatInfomaniak";
  }

  _llmType() {
    return "infomaniak";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "INFOMANIAK_API_KEY",
    };
  }

  lc_serializable = true;

  lc_namespace = ["langchain", "chat_models", "infomaniak"];

  constructor(model: string, fields?: Omit<ChatInfomaniakInput, "model">);
  constructor(fields?: Partial<ChatInfomaniakInput>);
  constructor(
    modelOrFields?: string | Partial<ChatInfomaniakInput>,
    fieldsArg?: Omit<ChatInfomaniakInput, "model">
  ) {
    const fields =
      typeof modelOrFields === "string"
        ? { ...(fieldsArg ?? {}), model: modelOrFields }
        : (modelOrFields ?? {});

    const apiKey =
      fields.apiKey ?? getEnvironmentVariable("INFOMANIAK_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Infomaniak API key not found. Please set the INFOMANIAK_API_KEY environment variable or pass the key into the "apiKey" field.`
      );
    }

    const productId =
      fields.productId ?? getEnvironmentVariable("INFOMANIAK_PRODUCT_ID");
    if (!productId) {
      throw new Error(
        `Infomaniak product ID not found. Please set the INFOMANIAK_PRODUCT_ID environment variable or pass the ID into the "productId" field.`
      );
    }

    const baseURL = `https://api.infomaniak.com/2/ai/${productId}/openai/v1`;

    super({
      model: fields.model ?? "qwen3",
      ...fields,
      apiKey,
      configuration: {
        baseURL,
        ...fields.configuration,
      },
    });
    this._addVersion("@langchain/infomaniak", __PKG_VERSION__);
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      | SerializableSchema<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      | SerializableSchema<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      | SerializableSchema<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      | SerializableSchema<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    const ensuredConfig = { ...config };
    // Infomaniak does not reliably support json_schema method yet
    if (ensuredConfig?.method === undefined) {
      ensuredConfig.method = "functionCalling";
    }
    return super.withStructuredOutput<RunOutput>(outputSchema, ensuredConfig);
  }
}
