import { WikipediaAPIWrapper } from "langchain/tools";

const tool = new WikipediaAPIWrapper({
  top_k_results: 3,
  doc_content_chars_max: 4000,
});

const res = await tool.call("Langchain");

console.log(res);
