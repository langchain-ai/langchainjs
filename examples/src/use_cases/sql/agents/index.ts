import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { createOpenAIToolsAgent, AgentExecutor } from "langchain/agents";
import { SqlToolkit } from "langchain/agents/toolkits/sql";
import { AIMessage } from "langchain/schema";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";

const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});
const llm = new ChatOpenAI({ model: "gpt-3.5-turbo", temperature: 0 });
const sqlToolKit = new SqlToolkit(db, llm);
const tools = sqlToolKit.getTools();
const SQL_PREFIX = `You are an agent designed to interact with a SQL database.
Given an input question, create a syntactically correct {dialect} query to run, then look at the results of the query and return the answer.
Unless the user specifies a specific number of examples they wish to obtain, always limit your query to at most {top_k} results using the LIMIT clause.
You can order the results by a relevant column to return the most interesting examples in the database.
Never query for all the columns from a specific table, only ask for a the few relevant columns given the question.
You have access to tools for interacting with the database.
Only use the below tools.
Only use the information returned by the below tools to construct your final answer.
You MUST double check your query before executing it. If you get an error while executing a query, rewrite the query and try again.

DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database.

If the question does not seem related to the database, just return "I don't know" as the answer.`;
const SQL_SUFFIX = `Begin!

Question: {input}
Thought: I should look at the tables in the database to see what I can query.
{agent_scratchpad}`;
const prompt = ChatPromptTemplate.fromMessages([
  ["system", SQL_PREFIX],
  HumanMessagePromptTemplate.fromTemplate("{input}"),
  new AIMessage(SQL_SUFFIX.replace("{agent_scratchpad}", "")),
  new MessagesPlaceholder("agent_scratchpad"),
]);
const newPrompt = await prompt.partial({
  dialect: sqlToolKit.dialect,
  top_k: "10",
});
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
    input:
      "List the total sales per country. Which country's customers spent the most?",
  })
);
/**
 {
  input: "List the total sales per country. Which country's customers spent the most?",
  output: 'The total sales per country are as follows:\n' +
    '\n' +
    '1. USA: $523.06\n' +
    '2. Canada: $303.96\n' +
    '3. France: $195.10\n' +
    '4. Brazil: $190.10\n' +
    '5. Germany: $156.48\n' +
    '6. United Kingdom: $112.86\n' +
    '7. Czech Republic: $90.24\n' +
    '8. Portugal: $77.24\n' +
    '9. India: $75.26\n' +
    '10. Chile: $46.62\n' +
    '\n' +
    "To find out which country's customers spent the most, we can see that the customers from the USA spent the most with a total sales of $523.06."
}
 */

console.log(
  await agentExecutor.invoke({
    input: "Describe the playlisttrack table",
  })
);
/**
 {
  input: 'Describe the playlisttrack table',
  output: 'The `PlaylistTrack` table has two columns: `PlaylistId` and `TrackId`. Both columns are of type INTEGER and are not nullable (NOT NULL).\n' +
    '\n' +
    'Here are three sample rows from the `PlaylistTrack` table:\n' +
    '\n' +
    '| PlaylistId | TrackId |\n' +
    '|------------|---------|\n' +
    '| 1          | 3402    |\n' +
    '| 1          | 3389    |\n' +
    '| 1          | 3390    |\n' +
    '\n' +
    'Please let me know if there is anything else I can help you with.'
}
 */
