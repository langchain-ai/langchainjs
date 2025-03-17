/**
 * Mixed Loading MCP Servers Example - Firecrawl and Math
 *
 * This example demonstrates a mixed approach to loading MCP servers:
 * 1. Loading the math server from a configuration file
 * 2. Adding the firecrawl server directly in code
 */

import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import logger from '../src/logger.js';

// MCP client imports
import { MultiServerMCPClient } from '../src/index.js';

// Load environment variables from .env file
dotenv.config();

// Path for our partial config file (only containing math server)
const partialConfigPath = path.join(process.cwd(), 'examples', 'math_server_config.json');

/**
 * Create a configuration file for just the math server
 */
function createMathServerConfigFile() {
  const configContent = {
    servers: {
      math: {
        transport: 'stdio',
        command: 'python',
        args: [path.join(process.cwd(), 'examples', 'math_server.py')],
      },
    },
  };

  fs.writeFileSync(partialConfigPath, JSON.stringify(configContent, null, 2));
  logger.info(`Created math server configuration file at ${partialConfigPath}`);
}

/**
 * Example demonstrating how to use a mixed approach to loading MCP servers
 * This example loads one server from config and adds another directly in code
 */
async function runExample() {
  let client: MultiServerMCPClient | null = null;

  try {
    // Create the math server configuration file
    createMathServerConfigFile();

    logger.info('Initializing MCP client from math server configuration file...');

    // Create a client from the configuration file
    client = MultiServerMCPClient.fromConfigFile(partialConfigPath);

    // Initialize connections to the math server
    await client.initializeConnections();
    logger.info('Connected to math server from configuration');

    // Now add the firecrawl server directly in code
    logger.info('Adding firecrawl server directly in code...');
    await client.connectToServerViaStdio('firecrawl', 'npx', ['-y', 'firecrawl-mcp'], {
      // Adding the API key from environment
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY || '',
      // Optional configurations
      FIRECRAWL_RETRY_MAX_ATTEMPTS: '3',
    });

    logger.info('Connected to firecrawl server directly');

    // Get all tools from all servers
    const mcpTools = client.getTools() as StructuredToolInterface<z.ZodObject<any>>[];

    if (mcpTools.length === 0) {
      throw new Error('No tools found');
    }

    // Filter tools from different servers
    const mathTools = mcpTools.filter(tool => client!.getServerForTool(tool.name) === 'math');
    const firecrawlTools = mcpTools.filter(
      tool => client!.getServerForTool(tool.name) === 'firecrawl'
    );

    logger.info(
      `Loaded ${mathTools.length} math tools: ${mathTools.map(tool => tool.name).join(', ')}`
    );
    logger.info(
      `Loaded ${firecrawlTools.length} firecrawl tools: ${firecrawlTools.map(tool => tool.name).join(', ')}`
    );
    logger.info(`Loaded ${mcpTools.length} tools in total`);

    // Create an OpenAI model and bind the tools
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      temperature: 0,
    }).bindTools(mcpTools);

    // Create a tool node for the LangGraph
    const toolNode = new ToolNode(mcpTools);

    // ================================================
    // Create a LangGraph agent flow
    // ================================================
    console.log('\n=== CREATING LANGGRAPH AGENT FLOW ===');

    // Define the function that calls the model
    const llmNode = async (state: typeof MessagesAnnotation.State) => {
      console.log('Calling LLM with messages:', state.messages.length);
      const response = await model.invoke(state.messages);
      return { messages: [response] };
    };

    // Create a new graph with MessagesAnnotation
    const workflow = new StateGraph(MessagesAnnotation);

    // Add the nodes to the graph
    workflow.addNode('llm', llmNode);
    workflow.addNode('tools', toolNode);

    // Add edges - these define how nodes are connected
    workflow.addEdge(START as any, 'llm' as any);
    workflow.addEdge('tools' as any, 'llm' as any);

    // Conditional routing to end or continue the tool loop
    workflow.addConditionalEdges('llm' as any, state => {
      const lastMessage = state.messages[state.messages.length - 1];
      const aiMessage = lastMessage as AIMessage;

      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        console.log('Tool calls detected, routing to tools node');
        return 'tools' as any;
      }

      console.log('No tool calls, ending the workflow');
      return END as any;
    });

    // Compile the graph
    const app = workflow.compile();

    // Define a query that will require both servers
    const query =
      'First, scrape https://example.com and count how many paragraphs are there. Then, multiply that number by 5.';

    // Test the LangGraph agent with the query
    console.log('\n=== RUNNING LANGGRAPH AGENT ===');
    console.log(`\nQuery: ${query}`);

    // Run the LangGraph agent with the query
    const result = await app.invoke({
      messages: [new HumanMessage(query)],
    });

    // Display the full conversation
    console.log(`\nFinal Messages (${result.messages.length}):`);
    result.messages.forEach((msg: BaseMessage, i: number) => {
      const msgType = 'type' in msg ? msg.type : 'unknown';
      console.log(
        `[${i}] ${msgType}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`
      );
    });

    const finalMessage = result.messages[result.messages.length - 1];
    console.log(`\nResult: ${finalMessage.content}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1); // Exit with error code
  } finally {
    // Close all client connections
    if (client) {
      await client.close();
      console.log('\nClosed all connections');
    }

    // Clean up our config file
    if (fs.existsSync(partialConfigPath)) {
      fs.unlinkSync(partialConfigPath);
      logger.info(`Cleaned up math server configuration file at ${partialConfigPath}`);
    }

    // Exit process after a short delay to allow for cleanup
    setTimeout(() => {
      console.log('Example completed, exiting process.');
      process.exit(0);
    }, 500);
  }
}

// Run the example
runExample();
