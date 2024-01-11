import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatAnthropic } from "@langchain/anthropic";
import { SerpAPI } from "@langchain/community/tools/serpapi";

const search = new SerpAPI();

const prompt =
  PromptTemplate.fromTemplate(`Turn the following user input into a search query for a search engine:

{input}`);

const model = new ChatAnthropic({});

const chain = prompt.pipe(model).pipe(new StringOutputParser()).pipe(search);

const result = await chain.invoke({
  input: "Who is the current prime minister of Malaysia?",
});

console.log(result);
/*
  Anwar Ibrahim
*/
