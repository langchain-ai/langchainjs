/**
 * Filesystem MCP Server with LangGraph Example
 *
 * This example demonstrates how to use the Filesystem MCP server with LangGraph
 * to create a structured workflow for complex file operations.
 *
 * The graph-based approach allows:
 * 1. Clear separation of responsibilities (reasoning vs execution)
 * 2. Conditional routing based on file operation types
 * 3. Structured handling of complex multi-file operations
 *
 * It also demonstrates the onConnectionError feature by including an
 * optional server that might not be available - the client will continue working with
 * the servers that successfully connect.
 */

import { ChatOpenAI } from "@langchain/openai";
import {
  StateGraph,
  END,
  START,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "langchain";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// MCP client imports
import { MultiServerMCPClient } from "../src/index.js";

// Load environment variables from .env file
dotenv.config();

/**
 * Example demonstrating how to use MCP filesystem tools with LangGraph agent flows
 * This example focuses on file operations like reading multiple files and writing files
 */
export async function runExample(client?: MultiServerMCPClient) {
  try {
    console.log("Initializing MCP client...");

    // Create a client with configurations for the filesystem server
    // eslint-disable-next-line no-param-reassign
    client =
      client ??
      new MultiServerMCPClient({
        mcpServers: {
          filesystem: {
            transport: "stdio" as const,
            command: "npx",
            args: [
              "-y",
              "@modelcontextprotocol/server-filesystem",
              "./examples/filesystem_test", // This directory needs to exist
            ],
          },
          // This server is not available - demonstrate onConnectionError: "ignore"
          "optional-math-server": {
            transport: "http",
            url: "http://localhost:9999/mcp",
          },
        },
        onConnectionError: "ignore",
        useStandardContentBlocks: true,
      });

    console.log("Connected to servers");

    // Get all tools (flattened array is the default now)
    const mcpTools = await client.getTools();

    if (mcpTools.length === 0) {
      throw new Error("No tools found");
    }

    console.log(
      `Loaded ${mcpTools.length} MCP tools: ${mcpTools
        .map((tool) => tool.name)
        .join(", ")}`
    );

    // Check which servers are actually connected
    console.log("\n=== Server Connection Status ===");
    const serverNames = ["filesystem", "optional-math-server"];
    for (const serverName of serverNames) {
      const serverClient = await client.getClient(serverName);
      if (serverClient) {
        console.log(`✅ ${serverName}: Connected`);
      } else {
        console.log(`❌ ${serverName}: Failed to connect (skipped gracefully)`);
      }
    }

    // Create an OpenAI model with tools attached
    const systemMessage = `You are an assistant that helps users with file operations.
You have access to tools that can read and write files, create directories,
and perform other filesystem operations. Be careful with file operations,
especially writing and editing files. Always confirm the content and path before
making changes.

For file writing operations, format the content properly based on the file type.
For reading multiple files, you can use the read_multiple_files tool.`;

    const model = new ChatOpenAI({
      model: process.env.OPENAI_MODEL_NAME || "gpt-4o-mini",
      temperature: 0,
    }).bindTools(mcpTools);

    // Create a tool node for the LangGraph
    const toolNode = new ToolNode(mcpTools);

    // ================================================
    // Create a LangGraph agent flow
    // ================================================
    console.log("\n=== CREATING LANGGRAPH AGENT FLOW ===");

    // Define the function that calls the model
    const llmNode = async (state: typeof MessagesAnnotation.State) => {
      console.log(`Calling LLM with ${state.messages.length} messages`);

      // Add system message if it's the first call
      let { messages } = state;
      if (messages.length === 1 && HumanMessage.isInstance(messages[0])) {
        messages = [new SystemMessage(systemMessage), ...messages];
      }

      const response = await model.invoke(messages);
      return { messages: [response] };
    };

    // Create a new graph with MessagesAnnotation
    const workflow = new StateGraph(MessagesAnnotation)

      // Add the nodes to the graph
      .addNode("llm", llmNode)
      .addNode("tools", toolNode)

      // Add edges - these define how nodes are connected
      .addEdge(START, "llm")
      .addEdge("tools", "llm")

      // Conditional routing to end or continue the tool loop
      .addConditionalEdges("llm", (state) => {
        const lastMessage = state.messages[state.messages.length - 1];

        // Cast to AIMessage to access tool_calls property
        const aiMessage = lastMessage as AIMessage;
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          console.log("Tool calls detected, routing to tools node");

          // Log what tools are being called
          const toolNames = aiMessage.tool_calls
            .map((tc) => tc.name)
            .join(", ");
          console.log(`Tools being called: ${toolNames}`);

          return "tools";
        }

        // If there are no tool calls, we're done
        console.log("No tool calls, ending the workflow");
        return END;
      });

    // Compile the graph
    const app = workflow.compile();

    // Define examples to run
    const examples = [
      {
        name: "Write multiple files",
        query:
          "Create two files: 'notes.txt' with content 'Important meeting on Thursday' and 'reminder.txt' with content 'Call John about the project'.",
      },
      {
        name: "Read multiple files",
        query:
          "Read both notes.txt and reminder.txt files and create a summary file called 'summary.txt' that contains information from both files.",
      },
      {
        name: "Create directory structure",
        query:
          "Create a directory structure for a simple web project. Make a 'project' directory with subdirectories for 'css', 'js', and 'images'. Add an index.html file in the main project directory with a basic HTML5 template.",
      },
      {
        name: "Search and organize",
        query:
          "Search for all .txt files and create a new directory called 'text_files', then list the names of all found text files in a new file called 'text_files/index.txt'.",
      },
    ];

    // Run the examples
    console.log("\n=== RUNNING LANGGRAPH AGENT ===");

    for (const example of examples) {
      console.log(`\n--- Example: ${example.name} ---`);
      console.log(`Query: ${example.query}`);

      // Run the LangGraph agent
      const result = await app.invoke({
        messages: [new HumanMessage(example.query)],
      });

      // Display the final answer
      const finalMessage = result.messages[result.messages.length - 1];
      console.log(`\nResult: ${finalMessage.content}`);

      // Let's list the directory to see the changes
      console.log("\nDirectory listing after operations:");
      try {
        const listResult = await app.invoke({
          messages: [
            new HumanMessage(
              "List all files and directories in the current directory and show their structure."
            ),
          ],
        });
        const listMessage = listResult.messages[listResult.messages.length - 1];
        console.log(listMessage.content);
      } catch (error) {
        console.error("Error listing directory:", error);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1); // Exit with error code
  } finally {
    if (client) {
      await client.close();
      console.log("Closed all MCP connections");
    }

    // Exit process after a short delay to allow for cleanup
    setTimeout(() => {
      console.log("Example completed, exiting process.");
      process.exit(0);
    }, 500);
  }
}

/**
 * Create a directory for our tests if it doesn't exist yet
 */
async function setupTestDirectory() {
  const testDir = path.join("./examples", "filesystem_test");

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
    console.log(`Created test directory: ${testDir}`);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  setupTestDirectory()
    .then(() => runExample())
    .catch((error) => console.error("Setup error:", error));
}
