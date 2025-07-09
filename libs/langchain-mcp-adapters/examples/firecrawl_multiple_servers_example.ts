/**
 * Multiple MCP Servers Example - Firecrawl with Math Server
 *
 * This example demonstrates using multiple MCP servers from a single configuration file.
 * It includes both the Firecrawl server for web scraping and the Math server for calculations.
 */

/* eslint-disable no-console */
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import dotenv from "dotenv";

import { ClientConfig, MultiServerMCPClient } from "../src/index.js";

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration for multiple MCP servers
 */
const multipleServersConfig: ClientConfig = {
  mcpServers: {
    firecrawl: {
      transport: "stdio",
      command: "npx",
      args: ["-y", "firecrawl-mcp"],
      env: {
        FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY || "",
        FIRECRAWL_RETRY_MAX_ATTEMPTS: "3",
      },
    },
    // Math server configuration
    math: {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-math"],
    },
  },
  useStandardContentBlocks: true,
};

/**
 * Example demonstrating how to use multiple MCP servers with React agent
 * This example creates and loads a configuration file with multiple servers
 */
async function runExample() {
  let client: MultiServerMCPClient | null = null;

  try {
    console.log(
      "Initializing MCP client from multiple servers configuration..."
    );

    // Create a client from the configuration file
    client = new MultiServerMCPClient(multipleServersConfig);

    console.log("Connected to servers from multiple servers configuration");

    // Get all tools from all servers
    const mcpTools = await client.getTools();

    if (mcpTools.length === 0) {
      throw new Error("No tools found");
    }

    console.log(
      `Loaded ${mcpTools.length} MCP tools: ${mcpTools
        .map((tool) => tool.name)
        .join(", ")}`
    );

    // Create an OpenAI model
    const model = new ChatOpenAI({
      model: process.env.OPENAI_MODEL_NAME || "gpt-4o",
      temperature: 0,
    });

    // ================================================
    // Create a React agent
    // ================================================
    console.log("\n=== CREATING REACT AGENT ===");

    // Create the React agent
    const agent = createReactAgent({
      llm: model,
      tools: mcpTools,
    });

    // Define queries that will use both servers
    const queries = [
      "What is 25 multiplied by 18?",
      "Scrape the content from https://example.com and count how many paragraphs are there",
      "If I have 42 items and each costs $7.50, what is the total cost?",
    ];

    // Test the React agent with the queries
    console.log("\n=== RUNNING REACT AGENT ===");

    for (const query of queries) {
      console.log(`\nQuery: ${query}`);

      // Run the React agent with the query
      const result = await agent.invoke({
        messages: [new HumanMessage(query)],
      });

      // Display the final response
      const finalMessage = result.messages[result.messages.length - 1];
      console.log(`\nResult: ${finalMessage.content}`);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1); // Exit with error code
  } finally {
    // Close all client connections
    if (client) {
      await client.close();
      console.log("\nClosed all connections");
    }
  }
}

// Run the example
runExample().catch(console.error);
