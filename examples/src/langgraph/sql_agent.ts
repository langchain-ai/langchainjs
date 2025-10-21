import { SqlDatabase } from "@langchain/classic/sql_db";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import {
  Command,
  END,
  interrupt,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import fs from "node:fs/promises";
import path from "node:path";
import { DataSource } from "typeorm";
import { z } from "zod";

// Download and setup database
const url =
  "https://storage.googleapis.com/benchmarks-artifacts/chinook/Chinook.db";
const localPath = path.resolve("Chinook.db");

async function resolveDbPath() {
  const exists = await fs
    .access(localPath)
    .then(() => true)
    .catch(() => false);
  if (exists) {
    console.log(`${localPath} already exists, skipping download.`);
    return localPath;
  }
  const resp = await fetch(url);
  if (!resp.ok)
    throw new Error(`Failed to download DB. Status code: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(localPath, buf);
  console.log(`File downloaded and saved as ${localPath}`);
  return localPath;
}

const dbPath = await resolveDbPath();
const datasource = new DataSource({ type: "sqlite", database: dbPath });
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

console.log(`Dialect: ${db.appDataSourceOptions.type}`);
const tableNames = db.allTables.map((t) => t.tableName);
console.log(`Available tables: ${tableNames.join(", ")}`);
const sampleResults = await db.run("SELECT * FROM Artist LIMIT 5;");
console.log(`Sample output: ${sampleResults}`);

// Initialize LLM
const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

// Create tools
const listTablesTool = tool(
  async () => {
    const tableNames = db.allTables.map((t) => t.tableName);
    return tableNames.join(", ");
  },
  {
    name: "sql_db_list_tables",
    description:
      "Input is an empty string, output is a comma-separated list of tables in the database.",
    schema: z.object({}),
  }
);

const getSchemaTool = tool(
  async ({ table_names }) => {
    const tables = table_names.split(",").map((t) => t.trim());
    return await db.getTableInfo(tables);
  },
  {
    name: "sql_db_schema",
    description:
      "Input to this tool is a comma-separated list of tables, output is the schema and sample rows for those tables. Be sure that the tables actually exist by calling sql_db_list_tables first! Example Input: table1, table2, table3",
    schema: z.object({
      table_names: z.string().describe("Comma-separated list of table names"),
    }),
  }
);

const queryTool = tool(
  async ({ query }) => {
    try {
      const result = await db.run(query);
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "sql_db_query",
    description:
      "Input to this tool is a detailed and correct SQL query, output is a result from the database. If the query is not correct, an error message will be returned. If an error is returned, rewrite the query, check the query, and try again.",
    schema: z.object({
      query: z.string().describe("SQL query to execute"),
    }),
  }
);

const tools = [listTablesTool, getSchemaTool, queryTool];

// Create tool nodes
const getSchemaNode = new ToolNode([getSchemaTool]);
const runQueryNode = new ToolNode([queryTool]);

// Define node functions
async function listTables(state: typeof MessagesAnnotation.State) {
  const toolCall = {
    name: "sql_db_list_tables",
    args: {},
    id: "abc123",
    type: "tool_call" as const,
  };
  const toolCallMessage = new AIMessage({
    content: "",
    tool_calls: [toolCall],
  });

  const toolMessage = await listTablesTool.invoke({});
  const response = new AIMessage(`Available tables: ${toolMessage}`);

  return {
    messages: [
      toolCallMessage,
      new ToolMessage({ content: toolMessage, tool_call_id: "abc123" }),
      response,
    ],
  };
}

async function callGetSchema(state: typeof MessagesAnnotation.State) {
  const llmWithTools = llm.bindTools([getSchemaTool], {
    tool_choice: "any",
  });
  const response = await llmWithTools.invoke(state.messages);

  return { messages: [response] };
}

const topK = 5;

const generateQuerySystemPrompt = `
You are an agent designed to interact with a SQL database.
Given an input question, create a syntactically correct ${db.appDataSourceOptions.type}
query to run, then look at the results of the query and return the answer. Unless
the user specifies a specific number of examples they wish to obtain, always limit
your query to at most ${topK} results.

You can order the results by a relevant column to return the most interesting
examples in the database. Never query for all the columns from a specific table,
only ask for the relevant columns given the question.

DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database.
`;

async function generateQuery(state: typeof MessagesAnnotation.State) {
  const systemMessage = new SystemMessage(generateQuerySystemPrompt);
  const llmWithTools = llm.bindTools([queryTool]);
  const response = await llmWithTools.invoke([
    systemMessage,
    ...state.messages,
  ]);

  return { messages: [response] };
}

const checkQuerySystemPrompt = `
You are a SQL expert with a strong attention to detail.
Double check the sqlite query for common mistakes, including:
- Using NOT IN with NULL values
- Using UNION when UNION ALL should have been used
- Using BETWEEN for exclusive ranges
- Data type mismatch in predicates
- Properly quoting identifiers
- Using the correct number of arguments for functions
- Casting to the correct data type
- Using the proper columns for joins

If there are any of the above mistakes, rewrite the query. If there are no mistakes,
just reproduce the original query.

You will call the appropriate tool to execute the query after running this check.
`;

async function checkQuery(state: typeof MessagesAnnotation.State) {
  const systemMessage = new SystemMessage(checkQuerySystemPrompt);

  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    throw new Error("No tool calls found in the last message");
  }
  const toolCall = lastMessage.tool_calls[0];
  const userMessage = new HumanMessage(toolCall.args.query);
  const llmWithTools = llm.bindTools([queryTool], {
    tool_choice: "any",
  });
  const response = await llmWithTools.invoke([systemMessage, userMessage]);
  response.id = lastMessage.id;

  return { messages: [response] };
}

// Build the graph
function shouldContinue(
  state: typeof MessagesAnnotation.State
): "check_query" | typeof END {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return END;
  } else {
    return "check_query";
  }
}

const builder = new StateGraph(MessagesAnnotation)
  .addNode("list_tables", listTables)
  .addNode("call_get_schema", callGetSchema)
  .addNode("get_schema", getSchemaNode)
  .addNode("generate_query", generateQuery)
  .addNode("check_query", checkQuery)
  .addNode("run_query", runQueryNode)
  .addEdge(START, "list_tables")
  .addEdge("list_tables", "call_get_schema")
  .addEdge("call_get_schema", "get_schema")
  .addEdge("get_schema", "generate_query")
  .addConditionalEdges("generate_query", shouldContinue)
  .addEdge("check_query", "run_query")
  .addEdge("run_query", "generate_query");

const agent = builder.compile();

// Run the agent
const question = "Which genre on average has the longest tracks?";

console.log("\n=== Running SQL Agent ===\n");

const stream = await agent.stream(
  { messages: [{ role: "user", content: question }] },
  { streamMode: "values" }
);

for await (const step of stream) {
  const lastMessage = step.messages[step.messages.length - 1];
  console.log(lastMessage.toFormattedString());
}

console.log("\n=== Agent completed ===\n");

// ===== Human-in-the-loop implementation =====

console.log("\n=== Setting up agent with human-in-the-loop ===\n");

// Create a tool with interrupt for human review
const queryToolWithInterrupt = tool(
  async (input, config: RunnableConfig) => {
    const request = {
      action: queryTool.name,
      args: input,
      description: "Please review the tool call",
    };
    const response = interrupt([request]);
    // approve the tool call
    if (response.type === "accept") {
      const toolResponse = await queryTool.invoke(input, config);
      return toolResponse;
    }
    // update tool call args
    else if (response.type === "edit") {
      const editedInput = response.args.args;
      const toolResponse = await queryTool.invoke(editedInput, config);
      return toolResponse;
    }
    // respond to the LLM with user feedback
    else if (response.type === "response") {
      const userFeedback = response.args;
      return userFeedback;
    } else {
      throw new Error(`Unsupported interrupt response type: ${response.type}`);
    }
  },
  {
    name: queryTool.name,
    description: queryTool.description,
    schema: queryTool.schema,
  }
);

// Modified shouldContinue for human-in-the-loop version
function shouldContinueWithHuman(
  state: typeof MessagesAnnotation.State
): "run_query" | typeof END {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return END;
  } else {
    return "run_query";
  }
}

// Create tool node with interrupt
const runQueryNodeWithInterrupt = new ToolNode([queryToolWithInterrupt]);

// Build graph with human-in-the-loop
const builderWithHuman = new StateGraph(MessagesAnnotation)
  .addNode("list_tables", listTables)
  .addNode("call_get_schema", callGetSchema)
  .addNode("get_schema", getSchemaNode)
  .addNode("generate_query", generateQuery)
  .addNode("run_query", runQueryNodeWithInterrupt)
  .addEdge(START, "list_tables")
  .addEdge("list_tables", "call_get_schema")
  .addEdge("call_get_schema", "get_schema")
  .addEdge("get_schema", "generate_query")
  .addConditionalEdges("generate_query", shouldContinueWithHuman)
  .addEdge("run_query", "generate_query");

const checkpointer = new MemorySaver();
const agentWithHuman = builderWithHuman.compile({ checkpointer });

// Run the agent with human-in-the-loop
const config = { configurable: { thread_id: "1" } };

console.log("\n=== Running SQL Agent with Human-in-the-Loop ===\n");

const streamWithHuman = await agentWithHuman.stream(
  { messages: [{ role: "user", content: question }] },
  { ...config, streamMode: "values" }
);

for await (const step of streamWithHuman) {
  if (step.messages && step.messages.length > 0) {
    const lastMessage = step.messages[step.messages.length - 1];
    console.log(lastMessage.toFormattedString());
  }
}

// Check for interrupts
const state = await agentWithHuman.getState(config);
if (state.next.length > 0) {
  console.log("\nINTERRUPTED:");
  console.log(JSON.stringify(state.tasks[0].interrupts[0], null, 2));

  // Resume with approval
  console.log("\n=== Resuming with approval ===\n");

  const resumeStream = await agentWithHuman.stream(
    new Command({ resume: { type: "accept" } }),
    // new Command({ resume: { type: "edit", args: { query: "..." } } }),
    { ...config, streamMode: "values" }
  );

  for await (const step of resumeStream) {
    if (step.messages && step.messages.length > 0) {
      const lastMessage = step.messages[step.messages.length - 1];
      console.log(lastMessage.toFormattedString());
    }
  }

  console.log("\n=== Agent with human-in-the-loop completed ===\n");
}
