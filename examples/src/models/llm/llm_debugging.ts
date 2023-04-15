import { LLMResult } from "langchain/schema";
import { CallbackManager } from "langchain/callbacks";
import { OpenAI } from "langchain/llms/openai";

export const run = async () => {
  // We can pass in a `CallbackManager` to the LLM constructor to get callbacks for various events.
  const callbackManager = CallbackManager.fromHandlers({
    handleLLMStart: async (llm: { name: string }, prompts: string[]) => {
      console.log(JSON.stringify(llm, null, 2));
      console.log(JSON.stringify(prompts, null, 2));
    },
    handleLLMEnd: async (output: LLMResult) => {
      console.log(JSON.stringify(output, null, 2));
    },
    handleLLMError: async (err: Error) => {
      console.error(err);
    },
  });

  const model = new OpenAI({
    verbose: true,
    callbackManager,
  });

  await model.call(
    "What would be a good company name a company that makes colorful socks?"
  );
  // {
  //     "name": "openai"
  // }
  // [
  //     "What would be a good company name a company that makes colorful socks?"
  // ]
  // {
  //   "generations": [
  //     [
  //         {
  //             "text": "\n\nSocktastic Splashes.",
  //             "generationInfo": {
  //                 "finishReason": "stop",
  //                 "logprobs": null
  //             }
  //         }
  //     ]
  //  ],
  //   "llmOutput": {
  //     "tokenUsage": {
  //         "completionTokens": 9,
  //          "promptTokens": 14,
  //          "totalTokens": 23
  //     }
  //   }
  // }
};
