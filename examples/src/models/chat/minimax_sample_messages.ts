import { AIMessage, HumanMessage } from "langchain/schema";
import { ChatMinimax } from "langchain/chat_models/minimax";

const model = new ChatMinimax({
  modelName: "abab5.5-chat",
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
}).bind({
  sampleMessages: [
    new HumanMessage({
      content: " Turn A5 into red and modify the content to minimax.",
    }),
    new AIMessage({
      content: "select A5 color red change minimax",
    }),
  ],
});

const result = await model.invoke([
  new HumanMessage({
    content:
      ' Please reply to my content according to the following requirements: According to the following interface list, give the order and parameters of calling the interface for the content I gave. You just need to give the order and parameters of calling the interface, and do not give any other output. The following is the available interface list: select: select specific table position, input parameter use letters and numbers to determine, for example "B13"; color: dye the selected table position, input parameters use the English name of the color, for example "red"; change: modify the selected table position, input parameters use strings.',
  }),
  new HumanMessage({
    content: " Process B6 to gray and modify the content to question.",
  }),
]);

console.log(result);
