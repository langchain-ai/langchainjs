import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { SqlToolkit } from "langchain/agents/toolkits/sql";
import { SqlDatabase } from "langchain/sql_db";
import { Tool } from "langchain/tools";
import { createRetrieverTool } from "langchain/tools/retriever";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { DataSource } from "typeorm";

const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

async function queryAsList(query: string): Promise<string[]> {
  const res: Array<{ [key: string]: string }> = JSON.parse(await db.run(query))
    .flat()
    .filter((el: any) => el != null);
  const justValues: Array<string> = res.map((item) =>
    Object.values(item)[0]
      .replace(/\b\d+\b/g, "")
      .trim()
  );
  return justValues;
}

const artists = await queryAsList("SELECT Name FROM Artist");
const albums = await queryAsList("SELECT Title FROM Album");
console.log(albums.slice(0, 5));
/**
[
  'For Those About To Rock We Salute You',
  'Balls to the Wall',
  'Restless and Wild',
  'Let There Be Rock',
  'Big Ones'
]
 */

// Now we can proceed with creating the custom retriever tool and the final agent:

const vectorDb = await MemoryVectorStore.fromTexts(
  artists,
  {},
  new OpenAIEmbeddings()
);
const retriever = vectorDb.asRetriever(15);
const description = `Use to look up values to filter on.
Input is an approximate spelling of the proper noun, output is valid proper nouns.
Use the noun most similar to the search.`;
const retrieverTool = createRetrieverTool(retriever, {
  description,
  name: "search_proper_nouns",
}) as unknown as Tool;

const system = `You are an agent designed to interact with a SQL database.
Given an input question, create a syntactically correct {dialect} query to run, then look at the results of the query and return the answer.
Unless the user specifies a specific number of examples they wish to obtain, always limit your query to at most {top_k} results.
You can order the results by a relevant column to return the most interesting examples in the database.
Never query for all the columns from a specific table, only ask for the relevant columns given the question.
You have access to tools for interacting with the database.
Only use the given tools. Only use the information returned by the tools to construct your final answer.
You MUST double check your query before executing it. If you get an error while executing a query, rewrite the query and try again.

DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database.

If you need to filter on a proper noun, you must ALWAYS first look up the filter value using the "search_proper_nouns" tool! 

You have access to the following tables: {table_names}

If the question does not seem related to the database, just return "I don't know" as the answer.`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", system],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);
const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
const sqlToolKit = new SqlToolkit(db, llm);
const newPrompt = await prompt.partial({
  dialect: sqlToolKit.dialect,
  top_k: "10",
  table_names: db.allTables.map((t) => t.tableName).join(", "),
});
const tools = [...sqlToolKit.getTools(), retrieverTool];
const runnableAgent = await createOpenAIToolsAgent({
  llm,
  tools,
  prompt: newPrompt,
});
const agentExecutor = new AgentExecutor({
  agent: runnableAgent,
  tools,
});
console.log(
  await agentExecutor.invoke({
    input: "How many albums does alis in chain have?",
  })
);
/**
{
  input: 'How many albums does alis in chain have?',
  output: 'Alice In Chains has 1 album.'
}
 */
