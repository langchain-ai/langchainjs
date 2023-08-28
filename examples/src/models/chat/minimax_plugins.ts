import { HumanMessage } from "langchain/schema";
import { ChatMinimax } from "langchain/chat_models/minimax";


const model = new ChatMinimax({
  modelName: "abab5.5-chat",
  proVersion: true,
  verbose: true,
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
  replyConstraints: {
    sender_type: "BOT",
    sender_name: "MM Assistant",
  },
}).bind({
  plugins: ["plugin_web_search"],
});

const result = await model.invoke([
  new HumanMessage({
    content: " What is the weather like in Shanghai tomorrow?",
    name: "XiaoMing",
  }),
]);

console.log(result);

/*
  AIMessage {
    content: '',
    name: undefined,
    additional_kwargs: {
      function_call: {
        name: 'extractor',
        arguments: '{\n' +
          '  "tone": "positive",\n' +
          '  "entity": "day",\n' +
          '  "word_count": 4,\n' +
          '  "chat_response": "It certainly is a gorgeous day!",\n' +
          '  "final_punctuation": "!"\n' +
          '}'
      }
    }
  }
*/
