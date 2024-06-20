import {
  LangSmithParams,
  SimpleChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import type {
  BaseLanguageModelCallOptions,
  BaseLanguageModelInput,
  ToolDefinition,
} from "@langchain/core/language_models/base";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

import { StructuredToolInterface } from "@langchain/core/tools";
import { Runnable } from "@langchain/core/runnables";
import { isStructuredTool } from "@langchain/core/utils/function_calling";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ToolCall } from "@langchain/core/messages/tool";
import { convertEventStreamToIterableReadableDataStream } from "./utils/event_source_parse.js";
import type { CloudflareWorkersAIInput } from "./llms.js";

export type CloudflareTool = {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: Record<string, any>;
};

type CloudflareToolResponse = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arguments: Record<string, any>;
};

type Tool =
  | Record<string, unknown>
  | CloudflareTool
  | StructuredToolInterface
  | ToolDefinition;

const convertCloudflareToolsToLangChainTools = (
  tools: CloudflareToolResponse[]
): ToolCall[] =>
  tools.map((tc) => ({
    name: tc.name,
    args: tc.arguments,
  }));

function convertToCloudflareTools(tools: Tool[]): CloudflareTool[] {
  if (tools.every(isStructuredTool)) {
    return (tools as StructuredToolInterface[]).map((tc) => ({
      name: tc.name,
      description: tc.description,
      parameters: zodToJsonSchema(tc.schema),
    }));
  }
  if (
    tools.every(
      (t) =>
        !!(
          "type" in t &&
          t.type === "function" &&
          "function" in t &&
          typeof t.function === "object"
        )
    )
  ) {
    return (tools as ToolDefinition[]).map((tc) => ({
      name: tc.function.name,
      description:
        tc.function.description ?? `A function named ${tc.function.name}.`,
      parameters: tc.function.parameters,
    }));
  }
  if (
    tools.every(
      (t) =>
        !!(
          "name" in t &&
          "description" in t &&
          "parameters" in t &&
          typeof t.parameters === "object"
        )
    )
  ) {
    return tools as CloudflareTool[];
  }
  throw new Error(
    "Unsupported tool type received. Must be a list of structured tools, OpenAI tools, or Cloudflare tools."
  );
}

/**
 * An interface defining the options for a Cloudflare Workers AI call. It extends
 * the BaseLanguageModelCallOptions interface.
 */
export interface ChatCloudflareWorkersAICallOptions
  extends BaseLanguageModelCallOptions {
  tools?: Tool[];
}

/**
 * A class that enables calls to the Cloudflare Workers AI API to access large language
 * models in a chat-like fashion. It extends the SimpleChatModel class and
 * implements the CloudflareWorkersAIInput interface.
 * @example
 * ```typescript
 * const model = new ChatCloudflareWorkersAI({
 *   model: "@cf/meta/llama-2-7b-chat-int8",
 *   cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
 *   cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN
 * });
 *
 * const response = await model.invoke([
 *   ["system", "You are a helpful assistant that translates English to German."],
 *   ["human", `Translate "I love programming".`]
 * ]);
 *
 * console.log(response);
 * ```
 */
export class ChatCloudflareWorkersAI
  extends SimpleChatModel<ChatCloudflareWorkersAICallOptions>
  implements CloudflareWorkersAIInput
{
  static lc_name() {
    return "ChatCloudflareWorkersAI";
  }

  lc_serializable = true;

  model = "@cf/meta/llama-2-7b-chat-int8";

  cloudflareAccountId?: string;

  cloudflareApiToken?: string;

  baseUrl: string;

  streaming = false;

  constructor(fields?: CloudflareWorkersAIInput & BaseChatModelParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.streaming = fields?.streaming ?? this.streaming;
    this.cloudflareAccountId =
      fields?.cloudflareAccountId ??
      getEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID");
    this.cloudflareApiToken =
      fields?.cloudflareApiToken ??
      getEnvironmentVariable("CLOUDFLARE_API_TOKEN");
    this.baseUrl =
      fields?.baseUrl ??
      `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/ai/run`;
    if (this.baseUrl.endsWith("/")) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return {
      ls_provider: "cloudflare",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_stop: options.stop,
    };
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      cloudflareApiToken: "CLOUDFLARE_API_TOKEN",
    };
  }

  _llmType() {
    return "cloudflare";
  }

  /** Get the identifying parameters for this LLM. */
  get identifyingParams() {
    return { model: this.model };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(options?: this["ParsedCallOptions"]) {
    const tools =
      options?.tools && options.tools.length
        ? convertToCloudflareTools(options.tools)
        : undefined;
    return {
      model: this.model,
      tools,
    };
  }

  _combineLLMOutput() {
    return {};
  }

  /**
   * Method to validate the environment.
   */
  validateEnvironment() {
    if (!this.cloudflareAccountId) {
      throw new Error(
        `No Cloudflare account ID found. Please provide it when instantiating the CloudflareWorkersAI class, or set it as "CLOUDFLARE_ACCOUNT_ID" in your environment variables.`
      );
    }
    if (!this.cloudflareApiToken) {
      throw new Error(
        `No Cloudflare API key found. Please provide it when instantiating the CloudflareWorkersAI class, or set it as "CLOUDFLARE_API_KEY" in your environment variables.`
      );
    }
  }

  override bindTools(
    tools: Tool[],
    kwargs?: Partial<this["ParsedCallOptions"]>
  ): Runnable<
    BaseLanguageModelInput,
    AIMessageChunk,
    this["ParsedCallOptions"]
  > {
    return this.bind({
      tools: convertToCloudflareTools(tools),
      ...kwargs,
    } as Partial<this["ParsedCallOptions"]>);
  }

  async _request(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    stream?: boolean
  ) {
    this.validateEnvironment();
    const url = `${this.baseUrl}/${this.model}`;
    const headers = {
      Authorization: `Bearer ${this.cloudflareApiToken}`,
      "Content-Type": "application/json",
    };
    const params = this.invocationParams(options);
    const formattedMessages = this._formatMessages(messages);

    const data = { messages: formattedMessages, stream, tools: params.tools };
    return this.caller.call(async () => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal: options.signal,
      });
      if (!response.ok) {
        const error = new Error(
          `Cloudflare LLM call failed with status code ${response.status}`
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).response = response;
        throw error;
      }
      return response;
    });
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    if (options.tools?.length) {
      const invokeResult = await this._generate(messages, options, runManager);
      yield new ChatGenerationChunk({
        message: invokeResult.generations[0].message as AIMessageChunk,
        text: invokeResult.generations[0].text,
      });
      return;
    }

    const response = await this._request(messages, options, true);
    if (!response.body) {
      throw new Error("Empty response from Cloudflare. Please try again.");
    }
    const stream = convertEventStreamToIterableReadableDataStream(
      response.body
    );
    for await (const chunk of stream) {
      if (chunk !== "[DONE]") {
        const parsedChunk = JSON.parse(chunk);
        const message = new AIMessageChunk({
          content: parsedChunk.response,
        });
        const generationChunk = new ChatGenerationChunk({
          message,
          text: parsedChunk.response,
        });
        yield generationChunk;
        // eslint-disable-next-line no-void
        void runManager?.handleLLMNewToken(generationChunk.text ?? "");
      }
    }
  }

  protected _formatMessages(
    messages: BaseMessage[]
  ): { role: string; content: string }[] {
    const formattedMessages = messages.map((message) => {
      let role;
      if (message._getType() === "human") {
        role = "user";
      } else if (message._getType() === "ai") {
        role = "assistant";
      } else if (message._getType() === "system") {
        role = "system";
      } else if (ChatMessage.isInstance(message)) {
        role = message.role;
      } else {
        console.warn(
          `Unsupported message type passed to Cloudflare: "${message._getType()}"`
        );
        role = "user";
      }
      if (typeof message.content !== "string") {
        throw new Error(
          "ChatCloudflareWorkersAI currently does not support non-string message content."
        );
      }
      return {
        role,
        content: message.content,
      };
    });
    return formattedMessages;
  }

  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const chatResult = await this._generate(messages, options, runManager);
    return chatResult.generations[0].text;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    // Handle streaming
    if (this.streaming && !options.tools?.length) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      let finalResult: ChatGenerationChunk | undefined;
      for await (const chunk of stream) {
        if (finalResult === undefined) {
          finalResult = chunk;
        } else {
          finalResult = finalResult.concat(chunk);
        }
      }

      if (!finalResult) {
        throw new Error("No response from Cloudflare. Please try again.");
      }
      const messageContent = finalResult?.message.content;
      if (messageContent && typeof messageContent !== "string") {
        throw new Error(
          "Non-string output for ChatCloudflareWorkersAI is currently not supported."
        );
      }

      const generations = [
        {
          text: messageContent,
          message: finalResult.message,
        },
      ];

      return { generations };
    }

    const response = await this._request(messages, options).then((r) =>
      r.json()
    );

    let toolCalls: ToolCall[] | undefined;
    if ("tool_calls" in response.result) {
      toolCalls = convertCloudflareToolsToLangChainTools(
        response.result.tool_calls
      );
    }
    const generations = [
      {
        text: response.result.response,
        message: new AIMessage({
          content: response.result.response,
          response_metadata: response,
          tool_calls: toolCalls,
        }),
      },
    ];
    await runManager?.handleLLMNewToken(response.result.response ?? "");
    return {
      generations,
    };
  }
}
