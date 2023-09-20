import { NIBittensorChatModel } from "langchain/experimental/chat_models/bittensor";
import { HumanMessage } from "langchain/schema";

const chat = new NIBittensorChatModel();
const message = new HumanMessage("What is bittensor?");
const res = await chat.call([message]);
console.log({ res });
/*
  {
    res: "\nBittensor is opensource protocol..."
  }
 */
