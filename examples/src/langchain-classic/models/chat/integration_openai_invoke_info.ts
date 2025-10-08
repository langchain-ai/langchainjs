import { ChatOpenAI } from "@langchain/openai";

// See https://cookbook.openai.com/examples/using_logprobs for details
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  logprobs: true,
  // topLogprobs: 5,
});

const responseMessage = await model.invoke("Hi there!");

console.log(JSON.stringify(responseMessage, null, 2));

/*
  {
    "lc": 1,
    "type": "constructor",
    "id": [
      "langchain_core",
      "messages",
      "AIMessage"
    ],
    "kwargs": {
      "content": "Hello! How can I assist you today?",
      "additional_kwargs": {},
      "response_metadata": {
        "tokenUsage": {
          "completionTokens": 9,
          "promptTokens": 10,
          "totalTokens": 19
        },
        "finish_reason": "stop",
        "logprobs": {
          "content": [
            {
              "token": "Hello",
              "logprob": -0.0006793116,
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
              "logprob": -0.00011725161,
              "bytes": [
                33
              ],
              "top_logprobs": []
            },
            {
              "token": " How",
              "logprob": -0.000038457987,
              "bytes": [
                32,
                72,
                111,
                119
              ],
              "top_logprobs": []
            },
            {
              "token": " can",
              "logprob": -0.00094290765,
              "bytes": [
                32,
                99,
                97,
                110
              ],
              "top_logprobs": []
            },
            {
              "token": " I",
              "logprob": -0.0000013856493,
              "bytes": [
                32,
                73
              ],
              "top_logprobs": []
            },
            {
              "token": " assist",
              "logprob": -0.14702488,
              "bytes": [
                32,
                97,
                115,
                115,
                105,
                115,
                116
              ],
              "top_logprobs": []
            },
            {
              "token": " you",
              "logprob": -0.000001147242,
              "bytes": [
                32,
                121,
                111,
                117
              ],
              "top_logprobs": []
            },
            {
              "token": " today",
              "logprob": -0.000067901296,
              "bytes": [
                32,
                116,
                111,
                100,
                97,
                121
              ],
              "top_logprobs": []
            },
            {
              "token": "?",
              "logprob": -0.000014974867,
              "bytes": [
                63
              ],
              "top_logprobs": []
            }
          ]
        }
      }
    }
  }
*/
