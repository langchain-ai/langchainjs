import { HumanChatMessage, LLMResult } from "langchain/schema";
import { ChatOpenAI } from "langchain/chat_models/openai";

// We can pass in a list of CallbackHandlers to the LLM constructor to get callbacks for various events.
const model = new ChatOpenAI({
  callbacks: [
    {
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
    },
  ],
});

await model.call([
  new HumanChatMessage(
    "What is a good name for a company that makes colorful socks?"
  ),
]);
/*
{
  "name": "openai"
}
[
  "Human: What is a good name for a company that makes colorful socks?"
]
{
  "generations": [
    [
      {
        "text": "Rainbow Soles",
        "message": {
          "text": "Rainbow Soles"
        }
      }
    ]
  ],
  "llmOutput": {
    "tokenUsage": {
      "completionTokens": 4,
      "promptTokens": 21,
      "totalTokens": 25
    }
  }
}
*/
