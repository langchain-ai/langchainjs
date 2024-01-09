import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";

const tool = new WikipediaQueryRun({
  topKResults: 3,
  maxDocContentLength: 4000,
});

const res = await tool.call("Langchain");

console.log(res);
