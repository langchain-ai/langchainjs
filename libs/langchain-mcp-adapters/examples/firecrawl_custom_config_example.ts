/**
 * Firecrawl MCP Server Example - Custom Configuration
 *
 * This example demonstrates loading from a custom configuration file
 * And getting tools from the Firecrawl server with automatic initialization
 */

/* eslint-disable no-console */
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import dotenv from "dotenv";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// MCP client imports
import { type ClientConfig, MultiServerMCPClient } from "../src/index.js";

// Load environment variables from .env file
dotenv.config();

/**
 * A custom configuration for Firecrawl
 */
const config: ClientConfig = {
  mcpServers: {
    firecrawl: {
      transport: "sse",
      url: process.env.FIRECRAWL_SERVER_URL || "http://localhost:8000/v1/mcp",
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY || "demo"}`,
      },
    },
  },
  useStandardContentBlocks: true,
};

/**
 * Example demonstrating loading from custom configuration
 */
async function runExample() {
  let client: MultiServerMCPClient | null = null;

  // Add a timeout to prevent the process from hanging indefinitely
  const timeout = setTimeout(() => {
    console.error("Example timed out after 30 seconds");
    process.exit(1);
  }, 30000);

  try {
    // Initialize the MCP client with the custom configuration
    console.log("Initializing MCP client from custom configuration...");
    client = new MultiServerMCPClient(config);

    // Get Firecrawl tools specifically
    const firecrawlTools = await client.getTools("firecrawl");

    if (firecrawlTools.length === 0) {
      throw new Error("No Firecrawl tools found");
    }

    console.log(`Found ${firecrawlTools.length} Firecrawl tools`);

    // Initialize the LLM
    const model = new ChatOpenAI({
      model: process.env.OPENAI_MODEL_NAME || "gpt-3.5-turbo",
      temperature: 0,
    });

    // Create a React agent using LangGraph's createReactAgent
    const agent = createReactAgent({
      llm: model,
      tools: firecrawlTools,
    });

    // Define a query for testing Firecrawl
    const query =
      "Find the latest news about artificial intelligence and summarize the top 3 stories";

    console.log(`Running agent with query: ${query}`);

    // Run the agent
    const result = await agent.invoke({
      messages: [new HumanMessage(query)],
    });

    console.log("Agent execution completed");
    console.log("\nFinal output:");
    console.log(result);

    // Clear the timeout since the example completed successfully
    clearTimeout(timeout);
  } catch (error) {
    console.error("Error in example:", error);
  } finally {
    // Close all MCP connections
    if (client) {
      console.log("Closing all MCP connections...");
      await client.close();
      console.log("All MCP connections closed");
    }

    // Clear the timeout if it hasn't fired yet
    clearTimeout(timeout);

    // Complete the example
    console.log("Example execution completed");
    process.exit(0);
  }
}

// Run the example
runExample().catch(console.error);
