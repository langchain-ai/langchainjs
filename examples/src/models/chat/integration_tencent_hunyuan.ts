import { ChatTencentHunyuan } from "@langchain/community/chat_models/tencent_hunyuan";
import { HumanMessage } from "@langchain/core/messages";

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
const hunyuanLL = new ChatTencentHunyuan({
  model: "hunyuan-lite",
  streaming: true,
  temperature: 1,
});

res = await hunyuanLL.invoke(messages);
console.log(res);
/*
AIMessage {
  content: '您好！我是一个AI语言模型HunYuan,由腾讯开发和提供支持.您可以通过输入您的问题或请求来获取帮助和建议.',
  name: undefined,
  additional_kwargs: {},
  response_metadata: {
    tokenUsage: { totalTokens: 29, promptTokens: 1, completionTokens: 28 }
  },
  tool_calls: [],
  invalid_tool_calls: []
}
*/
