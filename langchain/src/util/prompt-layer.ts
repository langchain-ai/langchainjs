import fetch from 'cross-fetch';
import { CreateCompletionResponse } from "openai";
import { AsyncCaller } from "../util/async_caller.js";

export const getPromptLayerRequestID = async (
    callerFunc: AsyncCaller,
    functionName: string,
    modelName: string, 
    messages: string[],
    plTags: string[] | undefined,
    requestResponse: CreateCompletionResponse,
    startTime: number,
    endTime: number,
    apiKey: string | undefined
  ) => {
      // https://github.com/MagnivOrg/promptlayer-js-helper
      const promptLayerResp = await callerFunc.call(fetch, "https://api.promptlayer.com/track-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          function_name: functionName,
          args: [],
          kwargs: { engine: modelName, messages: messages },
          tags: plTags,
          request_response: requestResponse,
          request_start_time: Math.floor(startTime / 1000),
          request_end_time: Math.floor(endTime / 1000),
          api_key: apiKey,
        }),
      });

      const promptLayerRespBody = await promptLayerResp.json()

      let promptLayerRequestID: string | undefined = undefined
      if (promptLayerRespBody && promptLayerRespBody.success === true) {
        promptLayerRequestID = promptLayerRespBody.request_id
      }

      return promptLayerRequestID
    }