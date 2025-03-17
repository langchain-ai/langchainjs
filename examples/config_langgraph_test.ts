/**
 * Configuration Test with Math Server using LangGraph
 *
 * This example demonstrates using configuration files (auth_mcp.json and complex_mcp.json)
 * and directly connecting to the local math_server.py script using LangGraph.
 */

import { ChatOpenAI } from '@langchain/openai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import logger from '../src/logger.js';
import { StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';

// MCP client imports
import { MultiServerMCPClient } from '../src/index.js';

// Load environment variables from .env file
dotenv.config();

/**
 * This example demonstrates using multiple configuration files to
 * connect to different MCP servers and use their tools with LangGraph
 */
async function runConfigTest() {
  try {
    // Log when we start
    logger.info('Starting test with configuration files...');

    // Step 1: Load and verify auth_mcp.json configuration (just testing parsing)
    logger.info('Parsing auth_mcp.json configuration...');
    const authConfigPath = path.join(process.cwd(), 'examples', 'auth_mcp.json');

    if (!fs.existsSync(authConfigPath)) {
      throw new Error(`Configuration file not found: ${authConfigPath}`);
    }

    // Load the auth configuration to verify it parses correctly
    const authConfig = JSON.parse(fs.readFileSync(authConfigPath, 'utf-8'));
    logger.info('Successfully parsed auth_mcp.json with the following servers:');
    logger.info('Servers:', Object.keys(authConfig.servers));

    // Print auth headers (redacted for security) to verify they're present
    Object.entries(authConfig.servers).forEach(([serverName, serverConfig]: [string, any]) => {
      if (serverConfig.headers) {
        logger.info(
          `Server ${serverName} has headers:`,
          Object.keys(serverConfig.headers).map(key => `${key}: ***`)
        );
      }
    });

    // Step 2: Load and verify complex_mcp.json configuration
    logger.info('Parsing complex_mcp.json configuration...');
    const complexConfigPath = path.join(process.cwd(), 'examples', 'complex_mcp.json');

    if (!fs.existsSync(complexConfigPath)) {
      throw new Error(`Configuration file not found: ${complexConfigPath}`);
    }

    const complexConfig = JSON.parse(fs.readFileSync(complexConfigPath, 'utf-8'));
    logger.info('Successfully parsed complex_mcp.json with the following servers:');
    logger.info('Servers:', Object.keys(complexConfig.servers));

    // Step 3: Connect directly to the math server using explicit path
    logger.info('Connecting to math server directly...');

    // Define the python executable (use 'python3' on systems where 'python' might not be in PATH)
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    // Create a client with the math server only
    const client = new MultiServerMCPClient({
      math: {
        transport: 'stdio',
        command: pythonCmd,
        args: [path.join(process.cwd(), 'examples', 'math_server.py')],
      },
    });

    // Initialize connection to the math server
    await client.initializeConnections();

    // Get tools from the math server
    const mcpTools = client.getTools() as StructuredToolInterface<z.ZodObject<any>>[];
    logger.info(`Loaded ${mcpTools.length} tools from math server`);

    // Log the names of available tools
    const toolNames = mcpTools.map(tool => tool.name);
    logger.info('Available tools:', toolNames.join(', '));

    // Create an OpenAI model for the agent
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      temperature: 0,
    }).bindTools(mcpTools);

    // Create a tool node for the LangGraph
    const toolNode = new ToolNode(mcpTools);

    // Define the function that calls the model
    const llmNode = async (state: typeof MessagesAnnotation.State) => {
      logger.info('Calling LLM with messages:', state.messages.length);
      const response = await model.invoke(state.messages);
      return { messages: [response] };
    };

    // Create a new graph with MessagesAnnotation
    const workflow = new StateGraph(MessagesAnnotation);

    // Add the nodes to the graph
    workflow.addNode('llm', llmNode);
    workflow.addNode('tools', toolNode);

    // Add edges - need to cast to any to fix TypeScript errors
    workflow.addEdge(START as any, 'llm' as any);
    workflow.addEdge('tools' as any, 'llm' as any);

    // Add conditional logic to determine the next step
    workflow.addConditionalEdges('llm' as any, state => {
      const lastMessage = state.messages[state.messages.length - 1];

      // If the last message has tool calls, we need to execute the tools
      const aiMessage = lastMessage as AIMessage;
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        logger.info('Tool calls detected, routing to tools node');
        return 'tools' as any;
      }

      // If there are no tool calls, we're done
      logger.info('No tool calls, ending the workflow');
      return END as any;
    });

    // Compile the graph
    const app = workflow.compile();

    // Define test queries that use math tools
    const testQueries = [
      // Basic math queries
      'What is 5 + 3?',
      'What is 7 * 9?',
      'If I have 10 and add 15 to it, then multiply the result by 2, what do I get?',
    ];

    // Run each test query
    for (const query of testQueries) {
      logger.info(`\n=== Running query: "${query}" ===`);

      try {
        // Create initial messages with a system message and the user query
        const messages = [
          new SystemMessage(
            'You are a helpful assistant that can use tools to solve math problems.'
          ),
          new HumanMessage(query),
        ];

        // Run the LangGraph workflow
        const result = await app.invoke({ messages });

        // Get the last AI message as the response
        const lastMessage = result.messages.filter(message => message._getType() === 'ai').pop();

        logger.info(`\nFinal Answer: ${lastMessage?.content}`);
      } catch (error) {
        logger.error(`Error processing query "${query}":`, error);
      }
    }

    // Close all connections
    logger.info('\nClosing connections...');
    await client.close();

    logger.info('Test completed successfully');
  } catch (error) {
    logger.error('Error running test:', error);
  }
}

// Run the test
runConfigTest()
  .then(() => {
    logger.info('Configuration test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Error running configuration test:', error);
    process.exit(1);
  });
