import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { SemanticSimilarityExampleSelector } from "@langchain/core/example_selectors";
import {
  FewShotPromptTemplate,
  PromptTemplate,
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { SqlToolkit } from "langchain/agents/toolkits/sql";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { examples } from "./examples.js";

const exampleSelector = await SemanticSimilarityExampleSelector.fromExamples(
  examples,
  new OpenAIEmbeddings(),
  HNSWLib,
  {
    k: 5,
    inputKeys: ["input"],
  }
);
// Now we can create our FewShotPromptTemplate, which takes our example selector, an example prompt for formatting each example, and a string prefix and suffix to put before and after our formatted examples:
const SYSTEM_PREFIX = `You are an agent designed to interact with a SQL database.
Given an input question, create a syntactically correct {dialect} query to run, then look at the results of the query and return the answer.
Unless the user specifies a specific number of examples they wish to obtain, always limit your query to at most {top_k} results.
You can order the results by a relevant column to return the most interesting examples in the database.
Never query for all the columns from a specific table, only ask for the relevant columns given the question.
You have access to tools for interacting with the database.
Only use the given tools. Only use the information returned by the tools to construct your final answer.
You MUST double check your query before executing it. If you get an error while executing a query, rewrite the query and try again.

DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database.

If the question does not seem related to the database, just return "I don't know" as the answer.

Here are some examples of user inputs and their corresponding SQL queries:`;

const fewShotPrompt = new FewShotPromptTemplate({
  exampleSelector,
  examplePrompt: PromptTemplate.fromTemplate(
    "User input: {input}\nSQL query: {query}"
  ),
  inputVariables: ["input", "dialect", "top_k"],
  prefix: SYSTEM_PREFIX,
  suffix: "",
});

// Since our underlying agent is an [OpenAI tools agent](https://js.langchain.com/docs/modules/agents/agent_types/openai_tools_agent), which uses
// OpenAI function calling, our full prompt should be a chat prompt with a human message template and an agentScratchpad MessagesPlaceholder.
// The few-shot prompt will be used for our system message:

const fullPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessagePromptTemplate(fewShotPrompt),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

// And now we can create our agent with our custom prompt:

const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

const sqlToolKit = new SqlToolkit(db, llm);
const tools = sqlToolKit.getTools();
const newPrompt = await fullPrompt.partial({
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
  await agentExecutor.invoke({ input: "How many artists are there?" })
);
/**
{
  input: 'How many artists are there?',
  output: 'There are 275 artists.'
}
 */
