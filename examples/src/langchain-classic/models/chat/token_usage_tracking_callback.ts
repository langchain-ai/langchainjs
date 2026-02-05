import { ChatOpenAI } from "@langchain/openai";

const chatModel = new ChatOpenAI({
  model: "gpt-4o-mini",
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
          "text": "Why did the scarecrow win an award?\n\nBecause he was outstanding in his field!",
          "message": {
            "lc": 1,
            "type": "constructor",
            "id": [
              "langchain_core",
              "messages",
              "AIMessage"
            ],
            "kwargs": {
              "content": "Why did the scarecrow win an award?\n\nBecause he was outstanding in his field!",
              "tool_calls": [],
              "invalid_tool_calls": [],
              "additional_kwargs": {},
              "response_metadata": {
                "tokenUsage": {
                  "completionTokens": 17,
                  "promptTokens": 12,
                  "totalTokens": 29
                },
                "finish_reason": "stop"
              }
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
        "completionTokens": 17,
        "promptTokens": 12,
        "totalTokens": 29
      }
    }
  }
*/
