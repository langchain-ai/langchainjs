import {ChatGenerationChunk, ChatResult} from "@langchain/core/outputs";
import {BaseMessage, BaseMessageChunk} from "@langchain/core/messages";
import {GeminiAPIConfig, GoogleAIAPI, GoogleLLMResponse} from "../types.js";

export function getAnthropicAPI(_config?: GeminiAPIConfig): GoogleAIAPI {

  function notImplemented(): never {
    throw new Error("Not implemented");
  }

  function responseToString(
    _response: GoogleLLMResponse
  ): string {
    return notImplemented();
  }

  function responseToChatGeneration(
    _response: GoogleLLMResponse
  ): ChatGenerationChunk {
    return notImplemented();
  }

  function chunkToString(
    _chunk: BaseMessageChunk
  ): string {
    return notImplemented();
  }

  function responseToBaseMessage(
    _response: GoogleLLMResponse
  ): BaseMessage {
    return notImplemented();
  }

  function responseToChatResult(
    _response: GoogleLLMResponse
  ): ChatResult {
    return notImplemented();
  }

  return {
    responseToString,
    responseToChatGeneration,
    chunkToString,
    responseToBaseMessage,
    responseToChatResult,
  };

}
