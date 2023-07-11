import { WikipediaAPI } from "langchain/tools";

const tool = new WikipediaAPI({
  topKResults: 3,
  maxDocContentLength: 4000,
});

const res = await tool.call("Langchain");

console.log(res);
