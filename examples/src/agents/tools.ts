import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";

const tool = new WikipediaQueryRun({
  topKResults: 1,
  maxDocContentLength: 100,
});

console.log(tool.name);

console.log(tool.description);

console.log(tool.returnDirect);

const res = await tool.invoke("Langchain");

console.log(res);
