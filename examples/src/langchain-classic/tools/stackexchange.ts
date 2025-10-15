import { StackExchangeAPI } from "@langchain/community/tools/stackexchange";

// Get results from StackExchange API
const stackExchangeTool = new StackExchangeAPI();
const result = await stackExchangeTool.invoke("zsh: command not found: python");
console.log(result);

// Get results from StackExchange API with title query
const stackExchangeTitleTool = new StackExchangeAPI({
  queryType: "title",
});
const titleResult = await stackExchangeTitleTool.invoke(
  "zsh: command not found: python"
);
console.log(titleResult);

// Get results from StackExchange API with bad query
const stackExchangeBadTool = new StackExchangeAPI();
const badResult = await stackExchangeBadTool.invoke(
  "sjefbsmnazdkhbazkbdoaencopebfoubaef"
);
console.log(badResult);
