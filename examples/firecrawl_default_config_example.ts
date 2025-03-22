/**
 * Firecrawl MCP Server Example - Default Configuration
 *
 * This example demonstrates loading from default configuration file (mcp.json)
 * And getting tools from the Firecrawl server with automatic initialization
 */

/* eslint-disable no-console */
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import dotenv from "dotenv";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// MCP client imports
import { MultiServerMCPClient } from "../src/index.js";

// Load environment variables from .env file
dotenv.config();

/**
 * Example demonstrating loading from default configuration
 */
async function runExample() {
  let client: MultiServerMCPClient | null = null;

  // Add a timeout to prevent the process from hanging indefinitely
  const timeout = setTimeout(() => {
    console.error("Example timed out after 30 seconds");
    process.exit(1);
  }, 30000);

  try {
    console.log("Initializing MCP client from default configuration file...");

    // The client will automatically look for and load mcp.json from the current directory
    client = new MultiServerMCPClient();
    await client.initializeConnections();
    console.log("Connected to servers from default configuration");

    // Get Firecrawl tools specifically
    const mcpTools = client.getTools();
    const firecrawlTools = mcpTools.filter(
      (tool) => client!.getServerForTool(tool.name) === "firecrawl"
    );

    if (firecrawlTools.length === 0) {
      throw new Error("No Firecrawl tools found");
    }

    console.log(`Found ${firecrawlTools.length} Firecrawl tools`);

    // Initialize the LLM
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || "gpt-3.5-turbo",
      temperature: 0,
    });

    // Create a React agent using LangGraph's createReactAgent
    const agent = createReactAgent({
      llm: model,
      tools: firecrawlTools,
    });

    // Define a query for testing Firecrawl
    const query =
      "Scrape the content from https://example.com and summarize it in bullet points";

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
    console.log("Error in example:", error);
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
