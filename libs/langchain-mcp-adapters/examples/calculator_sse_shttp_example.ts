/**
 * Calculator MCP Server with LangGraph Example
 *
 * This example demonstrates how to use the Calculator MCP server with LangGraph
 * to create a structured workflow for simple calculations.
 *
 * The graph-based approach allows:
 * 1. Clear separation of responsibilities (reasoning vs execution)
 * 2. Conditional routing based on tool calls
 * 3. Structured handling of complex multi-tool operations
 */

/* eslint-disable no-console */
import { ChatOpenAI } from "@langchain/openai";
import {
  StateGraph,
  END,
  START,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  isHumanMessage,
} from "@langchain/core/messages";
import dotenv from "dotenv";

import { main as calculatorServerMain } from "./calculator_server_shttp_sse.js";

// MCP client imports
import { MultiServerMCPClient } from "../src/index.js";

// Load environment variables from .env file
dotenv.config();

const transportType = process.env.MCP_TRANSPORT_TYPE === "sse" ? "sse" : "http";

export async function runExample(client?: MultiServerMCPClient) {
  try {
    console.log("Initializing MCP client...");

    void calculatorServerMain();

    // Wait for the server to start
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    // Create a client with configurations for the calculator server
    // eslint-disable-next-line no-param-reassign
    client =
      client ??
      new MultiServerMCPClient({
        calculator: {
          url: `http://localhost:3000/${
            transportType === "sse" ? "sse" : "mcp"
          }`,
        },
      });

    console.log("Connected to server");

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

    // Create an OpenAI model with tools attached
    const systemMessage = `You are an assistant that helps users with calculations.
You have access to tools that can add, subtract, multiply, and divide numbers. Use
these tools to answer the user's questions.`;

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || "gpt-4o-mini",
      temperature: 0.7,
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
      if (messages.length === 1 && isHumanMessage(messages[0])) {
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
        name: "Add 1 and 2",
        query: "What is 1 + 2?",
      },
      {
        name: "Subtract 1 from 2",
        query: "What is 2 - 1?",
      },
      {
        name: "Multiply 1 and 2",
        query: "What is 1 * 2?",
      },
      {
        name: "Divide 1 by 2",
        query: "What is 1 / 2?",
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

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  runExample().catch((error) => console.error("Setup error:", error));
}
