import { NIBittensorLLM } from "langchain/experimental/chat_models/bittensor";
const model = new NIBittensorLLM();

const res = await model.call(`What is Bittensor?`);

console.log({ res });

/*
  {
    res: "\nBittensor is opensource protocol..."
  }
 */
