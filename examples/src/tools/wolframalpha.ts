import { WolframAlphaTool } from "langchain/tools";

const tool = new WolframAlphaTool({
  appid: "YOUR_APP_ID",
});

const res = await tool.invoke("What is 2 * 2?");

console.log(res);
