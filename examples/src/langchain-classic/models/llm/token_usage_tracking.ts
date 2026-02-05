import { OpenAI } from "@langchain/openai";

const llm = new OpenAI({
  model: "gpt-3.5-turbo-instruct",
  callbacks: [
    {
      handleLLMEnd(output) {
        console.log(JSON.stringify(output, null, 2));
      },
    },
  ],
});

await llm.invoke("Tell me a joke.");

/*
  {
    "generations": [
      [
        {
          "text": "\n\nWhy don't scientists trust atoms?\n\nBecause they make up everything.",
          "generationInfo": {
            "finishReason": "stop",
            "logprobs": null
          }
        }
      ]
    ],
    "llmOutput": {
      "tokenUsage": {
        "completionTokens": 14,
        "promptTokens": 5,
        "totalTokens": 19
      }
    }
  }
*/
