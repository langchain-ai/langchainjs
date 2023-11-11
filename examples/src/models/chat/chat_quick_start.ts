import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage } from "langchain/schema";

const chat = new ChatOpenAI({});
// Pass in a list of messages to `call` to start a conversation. In this simple example, we only pass in one message.
const response = await chat.call([
  new HumanMessage(
    "What is a good name for a company that makes colorful socks?"
  ),
]);
console.log(response);
// AIMessage { text: '\n\nRainbow Sox Co.' }
