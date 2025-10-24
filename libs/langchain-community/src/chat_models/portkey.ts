import { LLMOptions } from "portkey-ai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  ChatMessageChunk,
  FunctionMessageChunk,
  HumanMessage,
  HumanMessageChunk,
  SystemMessage,
  SystemMessageChunk,
} from "@langchain/core/messages";
import {
  ChatResult,
  ChatGeneration,
  ChatGenerationChunk,
} from "@langchain/core/outputs";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { PortkeySession, getPortkeySession } from "../llms/portkey.js";

interface Message {
  role?: string;
  content?: string;
}

function portkeyResponseToChatMessage(message: Message): BaseMessage {
  switch (message.role) {
    case "user":
      return new HumanMessage(message.content || "");
    case "assistant":
      return new AIMessage(message.content || "");
    case "system":
      return new SystemMessage(message.content || "");
    default:
      return new ChatMessage(message.content || "", message.role ?? "unknown");
  }
}

function _convertDeltaToMessageChunk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delta: Record<string, any>
) {
  const { role } = delta;
  const content = delta.content ?? "";
  let additional_kwargs;
  if (delta.function_call) {
    additional_kwargs = {
      function_call: delta.function_call,
    };
  } else {
    additional_kwargs = {};
  }
  if (role === "user") {
    return new HumanMessageChunk({ content });
  } else if (role === "assistant") {
    return new AIMessageChunk({ content, additional_kwargs });
  } else if (role === "system") {
    return new SystemMessageChunk({ content });
  } else if (role === "function") {
    return new FunctionMessageChunk({
      content,
      additional_kwargs,
      name: delta.name,
    });
  } else {
    return new ChatMessageChunk({ content, role });
  }
}

export class PortkeyChat extends BaseChatModel {
  apiKey?: string = undefined;

  baseURL?: string = undefined;

  mode?: string = undefined;

  llms?: [LLMOptions] | null = undefined;

  session: PortkeySession;

  constructor(init?: Partial<PortkeyChat>) {
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
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const messagesList = messages.map((message) => {
      if (typeof message.content !== "string") {
        throw new Error(
          "PortkeyChat does not support non-string message content."
        );
      }
      return {
        role: message._getType() as string,
        content: message.content,
      };
    });
    const response = await this.session.portkey.chatCompletions.create({
      messages: messagesList,
      ...options,
      stream: false,
    });
    const generations: ChatGeneration[] = [];
    for (const data of response.choices ?? []) {
      const text = data.message?.content ?? "";
      const generation: ChatGeneration = {
        text,
        message: portkeyResponseToChatMessage(data.message ?? {}),
      };
      if (data.finish_reason) {
        generation.generationInfo = { finish_reason: data.finish_reason };
      }
      generations.push(generation);
    }

    return {
      generations,
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const messagesList = messages.map((message) => {
      if (typeof message.content !== "string") {
        throw new Error(
          "PortkeyChat does not support non-string message content."
        );
      }
      return {
        role: message._getType() as string,
        content: message.content,
      };
    });
    const response = await this.session.portkey.chatCompletions.create({
      messages: messagesList,
      ...options,
      stream: true,
    });
    for await (const data of response) {
      const choice = data?.choices[0];
      if (!choice) {
        continue;
      }
      const chunk = new ChatGenerationChunk({
        message: _convertDeltaToMessageChunk(choice.delta ?? {}),
        text: choice.message?.content ?? "",
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

  _combineLLMOutput() {
    return {};
  }
}
