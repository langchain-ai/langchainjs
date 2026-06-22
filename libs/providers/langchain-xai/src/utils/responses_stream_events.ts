/**
 * Converts xAI Responses API stream events into LangChain ChatModelStreamEvents.
 *
 * xAI Responses events are wire-compatible with OpenAI Responses stream events.
 *
 * @module
 */

import { OpenAI as OpenAIClient } from "openai";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { convertOpenAIResponsesStream } from "@langchain/openai";
import type { XAIResponsesStreamEvent } from "../chat_models/responses-types.js";

export interface ConvertXAIResponsesStreamOptions {
  streamUsage?: boolean;
}

export async function* convertXAIResponsesStream(
  source: AsyncIterable<XAIResponsesStreamEvent>,
  options: ConvertXAIResponsesStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  async function* mapped() {
    for await (const event of source) {
      yield event as unknown as OpenAIClient.Responses.ResponseStreamEvent;
    }
  }
  yield* convertOpenAIResponsesStream(mapped(), {
    ...options,
    provider: "xai",
  });
}
