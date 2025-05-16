import { ChatMinimax } from "@langchain/community/chat_models/minimax";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatMinimax({
  model: "abab5.5-chat",
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
}).withConfig({
  plugins: ["plugin_web_search"],
});

const result = await model.invoke([
  new HumanMessage({
    content: " What is the weather like in NewYork tomorrow?",
  }),
]);

console.log(result);

/*
AIMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: 'The weather in Shanghai tomorrow is expected to be hot. Please note that this is just a forecast and the actual weather conditions may vary.',
    additional_kwargs: { function_call: undefined }
  },
  lc_namespace: [ 'langchain', 'schema' ],
  content: 'The weather in Shanghai tomorrow is expected to be hot. Please note that this is just a forecast and the actual weather conditions may vary.',
  name: undefined,
  additional_kwargs: { function_call: undefined }
}
*/
