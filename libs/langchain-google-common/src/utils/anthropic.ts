import {ChatGenerationChunk, ChatResult} from "@langchain/core/outputs";
import {BaseMessage, BaseMessageChunk} from "@langchain/core/messages";
import {GoogleAIAPI, GoogleAISafetyHandler, GoogleLLMResponse} from "../types.js";
import {GeminiAPIConfig} from "./gemini.js";

export function getAnthropicAPI(_config?: GeminiAPIConfig): GoogleAIAPI {

  function notImplemented(): never {
    throw new Error("Not implemented");
  }

  function safeResponseToString(
    _response: GoogleLLMResponse,
    _safetyHandler: GoogleAISafetyHandler
  ): string {
    return notImplemented();
  }

  function safeResponseToChatGeneration(
    _response: GoogleLLMResponse,
    _safetyHandler: GoogleAISafetyHandler
  ): ChatGenerationChunk {
    return notImplemented();
  }

  function chunkToString(
    _chunk: BaseMessageChunk
  ): string {
    return notImplemented();
  }

  function safeResponseToBaseMessage(
    _response: GoogleLLMResponse,
    _safetyHandler: GoogleAISafetyHandler
  ): BaseMessage {
    return notImplemented();
  }

  function safeResponseToChatResult(
    _response: GoogleLLMResponse,
    _safetyHandler: GoogleAISafetyHandler
  ): ChatResult {
    return notImplemented();
  }

  return {
    safeResponseToString,
    safeResponseToChatGeneration,
    chunkToString,
    safeResponseToBaseMessage,
    safeResponseToChatResult,
  };

}
