import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { SqlToolkit } from "langchain/agents/toolkits/sql";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { db } from "./db.js";

const llm = new ChatOpenAI({
  modelName: "gpt-4-0125-preview",
  temperature: 0,
});

const sqlToolKit = new SqlToolkit(db, llm);
const tools = sqlToolKit.getTools();

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a PostgreSQL expert. Given an input question, first create a syntactically correct PostgreSQL query to run, then look at the results of the query and return the answer to the input question.
Unless the user specifies in the question a specific number of examples to obtain, query for at most {top_k} results using the LIMIT clause as per PostgreSQL. You can order the results to return the most informative data in the database.
Never query for all columns from a table. You must query only the columns that are needed to answer the question. Wrap each column name in double quotes (") to denote them as delimited identifiers.
Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.

Use the following format:

Question: "Question here"
SQLQuery: "SQL Query to run"
SQLResult: "Result of the SQLQuery"
Answer: "Final answer here"

Only use the following tables:
{table_info}

Question: {input}`,
  ],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const runnableAgent = await createOpenAIToolsAgent({
  llm,
  tools,
  prompt,
});
const agentExecutor = new AgentExecutor({
  agent: runnableAgent,
  tools,
});

const result = await agentExecutor.invoke({
  input: "what's the average age of survivors",
  top_k: "5",
  table_info: db.allTables.map((t) => t.tableName).join("\n"),
});

console.log(result.output);
/**
The average age of survivors is approximately 28.41 years.
 */
