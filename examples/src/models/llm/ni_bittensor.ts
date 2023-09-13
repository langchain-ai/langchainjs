import { NIBittensorLLM } from "langchain/experimental/llms/bittensor";

const model = new NIBittensorLLM();

const res = await model.call(`What is Bittensor?`);

console.log({ res });

/*
  {
    res: "\nBittensor is opensource protocol..."
  }
 */
