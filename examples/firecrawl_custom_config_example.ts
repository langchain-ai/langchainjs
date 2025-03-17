/**
 * Firecrawl MCP Server Example - Custom Configuration
 *
 * This example demonstrates loading from a custom configuration file
 * And getting tools from the Firecrawl server with automatic initialization
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../src/logger.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';

// MCP client imports
import { MultiServerMCPClient } from '../src/index.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Create a custom configuration file for Firecrawl
 */
function createConfigFile(): string {
  const configPath = path.join(process.cwd(), 'examples', 'firecrawl_config.json');

  // Configuration for the Firecrawl server
  const config = {
    servers: {
      firecrawl: {
        transport: 'sse',
        url: process.env.FIRECRAWL_SERVER_URL || 'http://localhost:8000/v1/mcp',
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY || 'demo'}`,
        },
      },
    },
  };

  // Write the configuration to a file
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  return configPath;
}

/**
 * Example demonstrating loading from custom configuration
 */
async function runExample() {
  let client: MultiServerMCPClient | null = null;

  // Add a timeout to prevent the process from hanging indefinitely
  const timeout = setTimeout(() => {
    console.error('Example timed out after 30 seconds');
    process.exit(1);
  }, 30000);

  try {
    // Create a custom configuration file
    const configPath = createConfigFile();
    logger.info(`Created custom configuration file at: ${configPath}`);

    // Initialize the MCP client with the custom configuration
    logger.info('Initializing MCP client from custom configuration file...');
    client = MultiServerMCPClient.fromConfigFile(configPath);

    // Connect to the servers
    await client.initializeConnections();
    logger.info('Connected to servers from custom configuration');

    // Get Firecrawl tools specifically
    const mcpTools = client.getTools() as StructuredToolInterface<z.ZodObject<any>>[];
    const firecrawlTools = mcpTools.filter(
      tool => client!.getServerForTool(tool.name) === 'firecrawl'
    );

    if (firecrawlTools.length === 0) {
      throw new Error('No Firecrawl tools found');
    }

    logger.info(`Found ${firecrawlTools.length} Firecrawl tools`);

    // Initialize the LLM
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
      temperature: 0,
    });

    // Create a React agent using LangGraph's createReactAgent
    const agent = createReactAgent({
      llm: model,
      tools: firecrawlTools,
    });

    // Define a query for testing Firecrawl
    const query =
      'Find the latest news about artificial intelligence and summarize the top 3 stories';

    logger.info(`Running agent with query: ${query}`);

    // Run the agent
    const result = await agent.invoke({
      messages: [new HumanMessage(query)],
    });

    logger.info('Agent execution completed');
    console.log('\nFinal output:');
    console.log(result);

    // Clear the timeout since the example completed successfully
    clearTimeout(timeout);

    // Clean up the temporary configuration file
    fs.unlinkSync(configPath);
    logger.info('Removed temporary configuration file');
  } catch (error) {
    logger.error('Error in example:', error);
  } finally {
    // Close all MCP connections
    if (client) {
      logger.info('Closing all MCP connections...');
      await client.close();
      logger.info('All MCP connections closed');
    }

    // Clear the timeout if it hasn't fired yet
    clearTimeout(timeout);

    // Complete the example
    logger.info('Example execution completed');
    process.exit(0);
  }
}

// Run the example
runExample();
