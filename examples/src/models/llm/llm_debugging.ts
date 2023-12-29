import { OpenAI } from "@langchain/openai";
import type { LLMResult } from "langchain/schema";
import type { Serialized } from "langchain/load/serializable";

// We can pass in a list of CallbackHandlers to the LLM constructor to get callbacks for various events.
const model = new OpenAI({
  callbacks: [
    {
      handleLLMStart: async (llm: Serialized, prompts: string[]) => {
        console.log(JSON.stringify(llm, null, 2));
        console.log(JSON.stringify(prompts, null, 2));
      },
      handleLLMEnd: async (output: LLMResult) => {
        console.log(JSON.stringify(output, null, 2));
      },
      handleLLMError: async (err: Error) => {
        console.error(err);
      },
    },
  ],
});

await model.invoke(
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
