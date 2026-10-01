/**
 * Converts xAI Responses API stream events into LangChain ChatModelStreamEvents.
 *
 * xAI Responses events are wire-compatible with OpenAI Responses stream events.
 *
 * @module
 */

import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import {
  convertOpenAIResponsesStream,
  type OpenAIClient,
} from "@langchain/openai";
import type { XAIResponsesStreamEvent } from "../chat_models/responses-types.js";

export async function* convertXAIResponsesStream(
  source: AsyncIterable<XAIResponsesStreamEvent>
): AsyncGenerator<ChatModelStreamEvent> {
  async function* mapped() {
    for await (const event of source) {
      yield event as unknown as OpenAIClient.Responses.ResponseStreamEvent;
    }
  }
  yield* convertOpenAIResponsesStream(mapped(), { provider: "xai" });
}
