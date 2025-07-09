import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

// See https://cookbook.openai.com/examples/using_logprobs for details
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  logprobs: true,
  // topLogprobs: 5,
});

const generations = await model.invoke([new HumanMessage("Hi there!")]);

console.log(JSON.stringify(generations, null, 2));

/*
  {
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
                  "logprob": -0.0011337858,
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
                  "logprob": -0.00044127836,
                  "bytes": [
                    33
                  ],
                  "top_logprobs": []
                },
                {
                  "token": " How",
                  "logprob": -0.000065994034,
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
*/
