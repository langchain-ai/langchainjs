import type { OpenAI as OpenAIClient } from "openai";
import { AsyncCaller } from "../util/async_caller.js";

export const promptLayerTrackRequest = async (
  callerFunc: AsyncCaller,
  functionName: string,
  kwargs:
    | OpenAIClient.CompletionCreateParams
    | OpenAIClient.Chat.CompletionCreateParams,
  plTags: string[] | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestResponse: any,
  startTime: number,
  endTime: number,
  apiKey: string | undefined
) => {
  // https://github.com/MagnivOrg/promptlayer-js-helper
  const promptLayerResp = await callerFunc.call(
    fetch,
    "https://api.promptlayer.com/track-request",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        function_name: functionName,
        provider: "langchain",
        kwargs,
        tags: plTags,
        request_response: requestResponse,
        request_start_time: Math.floor(startTime / 1000),
        request_end_time: Math.floor(endTime / 1000),
        api_key: apiKey,
      }),
    }
  );

  return promptLayerResp.json();
};
