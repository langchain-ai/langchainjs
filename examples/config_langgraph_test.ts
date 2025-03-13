/**
 * Configuration Test with Math Server
 *
 * This example demonstrates using configuration files (auth_mcp.json and complex_mcp.json)
 * and directly connecting to the local math_server.py script.
 */

import { ChatOpenAI } from '@langchain/openai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import logger from '../src/logger.js';
import { AgentExecutor, createReactAgent } from 'langchain/agents';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';

// MCP client imports
import { MultiServerMCPClient } from '../src/index.js';

// Load environment variables from .env file
dotenv.config();

/**
 * This example demonstrates using multiple configuration files to
 * connect to different MCP servers and use their tools
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
    console.log('Successfully parsed auth_mcp.json with the following servers:');
    console.log('Servers:', Object.keys(authConfig.servers));

    // Print auth headers (redacted for security) to verify they're present
    Object.entries(authConfig.servers).forEach(([serverName, serverConfig]: [string, any]) => {
      if (serverConfig.headers) {
        console.log(
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
    console.log('Successfully parsed complex_mcp.json with the following servers:');
    console.log('Servers:', Object.keys(complexConfig.servers));

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
    const tools = client.getTools();
    logger.info(`Loaded ${tools.length} tools from math server`);

    // Log the names of available tools
    const toolNames = tools.map(tool => tool.name);
    console.log('Available tools:', toolNames.join(', '));

    // Create an OpenAI model for the agent
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      temperature: 0,
    });

    // Create the proper prompt template for the React agent
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `You are a helpful assistant that can use tools to answer math questions.

When you need to perform a calculation, use the appropriate math tool.

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`
      ),
      HumanMessagePromptTemplate.fromTemplate('{input}'),
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    // Create the React agent with the math tools
    const reactAgent = await createReactAgent({
      llm: model,
      tools: tools,
      prompt,
    });

    const executor = new AgentExecutor({
      agent: reactAgent,
      tools: tools,
      verbose: true,
    });

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
        const result = await executor.invoke({
          input: query,
        });

        console.log(`\nFinal Answer: ${result.output}`);
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
    logger.info('Configuration test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Error running configuration test:', error);
    process.exit(1);
  });
