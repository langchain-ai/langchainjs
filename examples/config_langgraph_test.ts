/**
 * Configuration Test with Math Server using LangGraph
 *
 * This example demonstrates using configuration files (auth_mcp.json and complex_mcp.json)
 * and directly connecting to the local math_server.py script using LangGraph.
 */

/* eslint-disable no-console */
import { ChatOpenAI } from '@langchain/openai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

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
    console.log('Starting test with configuration files...');

    // Step 1: Load and verify auth_mcp.json configuration (just testing parsing)
    console.log('Parsing auth_mcp.json configuration...');
    const authConfigPath = path.join(process.cwd(), 'examples', 'auth_mcp.json');

    if (!fs.existsSync(authConfigPath)) {
      throw new Error(`Configuration file not found: ${authConfigPath}`);
    }

    // Load the auth configuration to verify it parses correctly
    const authConfig = JSON.parse(fs.readFileSync(authConfigPath, 'utf-8'));
    console.log('Successfully parsed auth_mcp.json with the following servers:');
    console.log('Servers:', Object.keys(authConfig.servers));

    // Print auth headers (redacted for security) to verify they're present
    Object.entries(authConfig.servers).forEach(([serverName, serverConfig]) => {
      if (
        serverConfig &&
        typeof serverConfig === 'object' &&
        'headers' in serverConfig &&
        serverConfig.headers
      ) {
        console.log(
          `Server ${serverName} has headers:`,
          Object.keys(serverConfig.headers).map(key => `${key}: ***`)
        );
      }
    });

    // Step 2: Load and verify complex_mcp.json configuration
    console.log('Parsing complex_mcp.json configuration...');
    const complexConfigPath = path.join(process.cwd(), 'examples', 'complex_mcp.json');

    if (!fs.existsSync(complexConfigPath)) {
      throw new Error(`Configuration file not found: ${complexConfigPath}`);
    }

    const complexConfig = JSON.parse(fs.readFileSync(complexConfigPath, 'utf-8'));
    console.log('Successfully parsed complex_mcp.json with the following servers:');
    console.log('Servers:', Object.keys(complexConfig.servers));

    // Step 3: Connect directly to the math server using explicit path
    console.log('Connecting to math server directly...');

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
    const mcpTools = client.getTools();
    console.log(`Loaded ${mcpTools.length} tools from math server`);

    // Log the names of available tools
    const toolNames = mcpTools.map(tool => tool.name);
    console.log('Available tools:', toolNames.join(', '));

    // Create an OpenAI model for the agent
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      temperature: 0,
    }).bindTools(mcpTools);

    // Create a tool node for the LangGraph
    const toolNode = new ToolNode(mcpTools);

    // Define the function that calls the model
    const llmNode = async (state: typeof MessagesAnnotation.State) => {
      console.log('Calling LLM with messages:', state.messages.length);
      const response = await model.invoke(state.messages);
      return { messages: [response] };
    };

    // Create a new graph with MessagesAnnotation
    const workflow = new StateGraph(MessagesAnnotation)

      // Add the nodes to the graph
      .addNode('llm', llmNode)
      .addNode('tools', toolNode)

      // Add edges - need to cast to any to fix TypeScript errors
      .addEdge(START, 'llm')
      .addEdge('tools', 'llm')

      // Add conditional logic to determine the next step
      .addConditionalEdges('llm', state => {
        const lastMessage = state.messages[state.messages.length - 1];

        // If the last message has tool calls, we need to execute the tools
        const aiMessage = lastMessage as AIMessage;
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          console.log('Tool calls detected, routing to tools node');
          return 'tools';
        }

        // If there are no tool calls, we're done
        console.log('No tool calls, ending the workflow');
        return END;
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
      console.log(`\n=== Running query: "${query}" ===`);

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

        console.log(`\nFinal Answer: ${lastMessage?.content}`);
      } catch (error) {
        console.error(`Error processing query "${query}":`, error);
      }
    }

    // Close all connections
    console.log('\nClosing connections...');
    await client.close();

    console.log('Test completed successfully');
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Run the test
runConfigTest()
  .then(() => {
    console.log('Configuration test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running configuration test:', error);
    process.exit(1);
  });
