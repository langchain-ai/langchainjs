import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  BindToolsInput,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";

import {
  AIMessage,
  type BaseMessage,
  ChatMessage,
  AIMessageChunk,
} from "@langchain/core/messages";

import {
  ChatGenerationChunk,
  type ChatResult,
} from "@langchain/core/outputs";

import { type CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { Runnable } from "@langchain/core/runnables";
import {
  BaseLanguageModelInput,
  ToolDefinition,
} from "@langchain/core/language_models/base";

import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import {
  makeInvalidToolCall,
  parseToolCall,
} from "@langchain/core/output_parsers/openai_tools";

/* ---------------- types ---------------- */

type NVIDIAChatRole = "system" | "assistant" | "user";

interface NVIDIAChatMessage {
  role: NVIDIAChatRole;
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: NVIDIAChatMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  chat_template_kwargs?: {
    thinking?: boolean;
  };
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface ChoiceDelta {
  content?: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
}

interface Choice {
  index: number;
  finish_reason?: "stop" | "tool_calls" | "length";
  delta?: ChoiceDelta;
  message?: {
    role: string;
    content?: string;
    tool_calls?: ToolCall[];
  };
}

interface ChatCompletionResponse {
  id: string;
  choices: Choice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/* ---------------- utils ---------------- */

function messageToRole(message: BaseMessage): NVIDIAChatRole {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "system":
      return "system";
    case "generic":
      if (ChatMessage.isInstance(message)) {
        return message.role as NVIDIAChatRole;
      }
      throw new Error("Invalid generic message");
    default:
      throw new Error(`Unsupported message type: ${type}`);
  }
}

function parseRawToolCalls(raw: ToolCall[] = []) {
  const toolCalls = [];
  const invalidToolCalls = [];
  for (const call of raw) {
    try {
      toolCalls.push(parseToolCall(call, { returnId: true }));
    } catch (e: any) {
      invalidToolCalls.push(makeInvalidToolCall(call, e.message));
    }
  }
  return { toolCalls, invalidToolCalls };
}

/* ---------------- params ---------------- */

export interface ChatNVIDIACallOptions extends BaseChatModelCallOptions {
  tools?: BindToolsInput[];
}

export interface ChatNVIDIAParams {
  apiKey?: string;
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  streaming?: boolean;
  thinking?: boolean;
}

/* ---------------- main class ---------------- */

export class ChatNVIDIA
  extends BaseChatModel<ChatNVIDIACallOptions>
  implements ChatNVIDIAParams
{
  static lc_name() {
    return "ChatNVIDIA";
  }

  apiKey: string;
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  streaming: boolean;
  thinking: boolean;
  apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";

  constructor(fields: Partial<ChatNVIDIAParams> & BaseChatModelParams = {}) {
    super(fields);

    this.apiKey =
      fields.apiKey ?? getEnvironmentVariable("NVIDIA_API_KEY")!;
    if (!this.apiKey) {
      throw new Error("NVIDIA_API_KEY not found");
    }

    this.model = fields.model!;
    this.temperature = fields.temperature ?? 1;
    this.topP = fields.topP ?? 0.95;
    this.maxTokens = fields.maxTokens ?? 8192;
    this.streaming = fields.streaming ?? false;
    this.thinking = fields.thinking ?? false;
  }

  _llmType() {
    return "nvidia-nim";
  }

  invocationParams(options?: this["ParsedCallOptions"]) {
    return {
      model: this.model,
      temperature: this.temperature,
      top_p: this.topP,
      max_tokens: this.maxTokens,
      stream: this.streaming,
      tools: options?.tools?.map(convertToOpenAITool),
      chat_template_kwargs: this.thinking ? { thinking: true } : undefined,
    };
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const body: ChatCompletionRequest = {
      ...this.invocationParams(options),
      messages: messages.map((m) => ({
        role: messageToRole(m),
        content: m.content as string,
      })),
    };

    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    const data: ChatCompletionResponse = await res.json();
    const choice = data.choices[0];
    const content = choice.message?.content ?? "";

    const { toolCalls, invalidToolCalls } = parseRawToolCalls(
      choice.message?.tool_calls
    );

    return {
      generations: [
        {
          text: content,
          message: new AIMessage({
            content,
            tool_calls: toolCalls,
            invalid_tool_calls: invalidToolCalls,
          }),
        },
      ],
      llmOutput: data.usage && {
        tokenUsage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
      },
    };
  }

  bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<this["ParsedCallOptions"]>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk> {
    return this.withConfig({
      tools: tools.map(convertToOpenAITool),
      ...kwargs,
    });
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const body: ChatCompletionRequest = {
      ...this.invocationParams(options),
      stream: true,
      messages: messages.map((m) => ({
        role: messageToRole(m),
        content: m.content as string,
      })),
    };

    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;

        const data: ChatCompletionResponse = JSON.parse(payload);
        const delta = data.choices[0]?.delta ?? {};
        const text = delta.content ?? "";

        yield new ChatGenerationChunk({
          text,
          message: new AIMessageChunk({ content: text }),
        });

        await runManager?.handleLLMNewToken(text);
      }
    }
  }
}
