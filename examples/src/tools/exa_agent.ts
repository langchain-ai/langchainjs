import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import Exa from "exa-js";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { Tool } from "langchain/tools";

// @ts-expect-error Some TS Config's will cause this to give a TypeScript error, even though it works.
const client: Exa.default = new Exa(process.env.EXASEARCH_API_KEY);

class Search extends Tool {
  name = "search";

  description = "Search for a webpage based on the query.";

  async _call(input: string) {
    const results = await client.search(input, {
      useAutoprompt: true,
      numResults: 5,
    });
    return JSON.stringify(results, null, 2);
  }
}
class FindSimilar extends Tool {
  name = "find_similar_results";

  description =
    "Search for webpages similar to a given URL. The url passed in should be a URL returned from the `search` tool.";

  async _call(url: string) {
    const results = await client.findSimilar(url, {
      numResults: 5,
    });
    return JSON.stringify(results, null, 2);
  }
}
class GetContents extends Tool {
  name = "get_webpage_contents";

  description =
    "Get the contents of a webpage. The ids passed in should be a JSON stringified list of ids returned from `search`.";

  async _call(ids: string) {
    let parsedIds: string[];
    try {
      parsedIds = JSON.parse(ids);
    } catch (e) {
      return `Invalid JSON stringified IDs list. Recieved: ${ids}.\nError: ${e}`;
    }
    const results = await client.getContents(parsedIds);
    return JSON.stringify(results, null, 2);
  }
}

const tools = [new Search(), new FindSimilar(), new GetContents()];
const llm = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 });
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a web researcher who answers user questions by looking up information on the internet and retrieving contents of helpful documents. Cite your sources.`,
  ],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);
const agentExecutor = new AgentExecutor({
  agent: await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  }),
  tools,
});
console.log(
  await agentExecutor.invoke({
    input: "Summarize for me a fascinating article about cats.",
  })
);
