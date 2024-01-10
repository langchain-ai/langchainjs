import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";

const history = new ChatMessageHistory();

await history.addMessage(new HumanMessage("hi"));

await history.addMessage(new AIMessage("what is up?"));

console.log(await history.getMessages());

/*
  [
    HumanMessage {
      content: 'hi',
      additional_kwargs: {}
    },
    AIMessage {
      content: 'what is up?',
      additional_kwargs: {}
    }
  ]
*/
