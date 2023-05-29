import fetch from "cross-fetch";
import { AsyncCaller } from "../util/async_caller.js";
import { CreateCompletionRequestPrompt } from "openai";
import { CreateCompletionRequest } from "openai";

export const promptLayerTrackRequest = async (
  callerFunc: AsyncCaller,
  functionName: string,
  prompt: CreateCompletionRequestPrompt,
  kwargs: CreateCompletionRequest,
  plTags: string[] | undefined,
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
        args: prompt,
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
