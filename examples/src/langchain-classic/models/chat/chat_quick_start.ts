import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const chat = new ChatOpenAI({
  model: "gpt-4o-mini",
});
// Pass in a list of messages to `call` to start a conversation. In this simple example, we only pass in one message.
const response = await chat.invoke([
  new HumanMessage(
    "What is a good name for a company that makes colorful socks?"
  ),
]);
console.log(response);
// AIMessage { text: '\n\nRainbow Sox Co.' }
