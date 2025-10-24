import { ChatOpenAI } from "@langchain/openai";

// See https://cookbook.openai.com/examples/using_logprobs for details
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  logprobs: true,
  // topLogprobs: 5,
});

const result = await model.invoke("Hi there!", {
  callbacks: [
    {
      handleLLMEnd(output) {
        console.log("GENERATION OUTPUT:", JSON.stringify(output, null, 2));
      },
    },
  ],
});

console.log("FINAL OUTPUT", result);

/*
  GENERATION OUTPUT: {
    "generations": [
      [
        {
          "text": "Hello! How can I assist you today?",
          "message": {
            "lc": 1,
            "type": "constructor",
            "id": [
              "langchain_core",
              "messages",
              "AIMessage"
            ],
            "kwargs": {
              "content": "Hello! How can I assist you today?",
              "additional_kwargs": {}
            }
          },
          "generationInfo": {
            "finish_reason": "stop",
            "logprobs": {
              "content": [
                {
                  "token": "Hello",
                  "logprob": -0.0010195904,
                  "bytes": [
                    72,
                    101,
                    108,
                    108,
                    111
                  ],
                  "top_logprobs": []
                },
                {
                  "token": "!",
                  "logprob": -0.0004447316,
                  "bytes": [
                    33
                  ],
                  "top_logprobs": []
                },
                {
                  "token": " How",
                  "logprob": -0.00006682846,
                  "bytes": [
                    32,
                    72,
                    111,
                    119
                  ],
                  "top_logprobs": []
                },
                ...
              ]
            }
          }
        }
      ]
    ],
    "llmOutput": {
      "tokenUsage": {
        "completionTokens": 9,
        "promptTokens": 10,
        "totalTokens": 19
      }
    }
  }
  FINAL OUTPUT AIMessage {
    content: 'Hello! How can I assist you today?',
    additional_kwargs: { function_call: undefined, tool_calls: undefined }
  }
*/
