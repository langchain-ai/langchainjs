import { ChatOpenAI } from "@langchain/openai";

const chatModel = new ChatOpenAI({
  modelName: "gpt-4",
  callbacks: [
    {
      handleLLMEnd(output) {
        console.log(JSON.stringify(output, null, 2));
      },
    },
  ],
});

await chatModel.invoke("Tell me a joke.");

/*
  {
    "generations": [
      [
        {
          "text": "Why don't scientists trust atoms?\n\nBecause they make up everything!",
          "message": {
            "lc": 1,
            "type": "constructor",
            "id": [
              "langchain_core",
              "messages",
              "AIMessage"
            ],
            "kwargs": {
              "content": "Why don't scientists trust atoms?\n\nBecause they make up everything!",
              "additional_kwargs": {}
            }
          },
          "generationInfo": {
            "finish_reason": "stop"
          }
        }
      ]
    ],
    "llmOutput": {
      "tokenUsage": {
        "completionTokens": 13,
        "promptTokens": 12,
        "totalTokens": 25
      }
    }
  }
*/
