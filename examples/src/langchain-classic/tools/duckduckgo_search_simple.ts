import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";

// Instantiate the DuckDuckGoSearch tool.
const tool = new DuckDuckGoSearch({ maxResults: 1 });

// Get the results of a query by calling .invoke on the tool.
const result = await tool.invoke(
  "What is Anthropic's estimated revenue for 2024?"
);

console.log(result);
/*
[{
  "title": "Anthropic forecasts more than $850 mln in annualized revenue rate by ...",
  "link": "https://www.reuters.com/technology/anthropic-forecasts-more-than-850-mln-annualized-revenue-rate-by-2024-end-report-2023-12-26/",
  "snippet": "Dec 26 (Reuters) - Artificial intelligence startup <b>Anthropic</b> has projected it will generate more than $850 million in annualized <b>revenue</b> by the end of <b>2024</b>, the Information reported on Tuesday ..."
}]
*/
