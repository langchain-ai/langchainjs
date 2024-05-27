// in nodejs environment
import { ChatTencentHunyuan } from "@langchain/community/chat_models/tencent_hunyuan";

// in browser environment
// import { ChatTencentHunyuan } from "@langchain/community/chat_models/tencent_hunyuan/web";

import { HumanMessage } from "@langchain/core/messages";
import type { LLMResult } from "@langchain/core/outputs";

const messages = [new HumanMessage("Hello")];

// Default model is hunyuan-pro
const hunyuanPro = new ChatTencentHunyuan({
  streaming: false,
  temperature: 1,
});

let res = await hunyuanPro.invoke(messages);
console.log(res);
/*
AIMessage {
  content: 'Hello! How can I help you today?Is there anything I can do for you?',
  name: undefined,
  additional_kwargs: {},
  response_metadata: {
    tokenUsage: { totalTokens: 20, promptTokens: 1, completionTokens: 19 }
  },
  tool_calls: [],
  invalid_tool_calls: []
}
*/

// Use hunyuan-lite
const hunyuanLite = new ChatTencentHunyuan({
  model: "hunyuan-lite",
  streaming: false,
});

res = await hunyuanLite.invoke(messages);
console.log(res);
/*
AIMessage {
  content: '你好！很高兴为你提供服务~有什么我可以帮助你的吗？',
  name: undefined,
  additional_kwargs: {},
  response_metadata: {
    tokenUsage: { totalTokens: 14, promptTokens: 1, completionTokens: 13 }
  },
  tool_calls: [],
  invalid_tool_calls: []
}
*/

// Use hunyuan-lite with streaming
const hunyuanLiteStream = new ChatTencentHunyuan({
  model: "hunyuan-lite",
  streaming: true,
  temperature: 1,
});

hunyuanLiteStream.invoke(messages, {
  callbacks: [
    {
      handleLLMEnd(output: LLMResult) {
        console.log(output);
        /*
        {
          generations: [
            [
              [Object], [Object],
              [Object], [Object],
              [Object], [Object],
              [Object], [Object],
              [Object]
            ]
          ],
          llmOutput: {
            tokenUsage: { totalTokens: 9, promptTokens: 1, completionTokens: 8 }
          }
        }
      */
      },
      handleLLMNewToken(token: string) {
        console.log(`token: ${token}`);
        /*
        token: 你好
        token: ！
        token: 很高兴
        token: 能
        token: 为您
        token: 解答
        token: 问题
        token: 和建议
        token: 方案
        token: .
        token:  如果您
        token: 有其他
        token: 需要帮助
        token: 的地方
        token: ,
        token:
        token: 随时
        token: 告诉我
        token: 哦
        token: ~
        token:
        */
      },
    },
  ],
});
