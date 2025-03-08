/**
 * Test file to demonstrate and verify issue #3:
 * "Result from tool invocation appears to be different than the expected structure when called within createReactAgent"
 *
 * This example shows how to use MCP tools with different agent implementations.
 *
 * Key findings:
 * 1. The React agent requires LLMs to implement a 'bindTools' method
 * 2. Gemini models have specific requirements for tool schemas (non-empty objects)
 * 3. Standard agents work more reliably with MCP tools than React agents
 */

import { MultiServerMCPClient } from '../src/index.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { HumanMessage } from '@langchain/core/messages';
import { ToolNode, createReactAgent } from '@langchain/langgraph/prebuilt';
import dotenv from 'dotenv';
import logger from '../src/logger.js';

// Load environment variables from .env file
dotenv.config();

// Set logger level to see verbose output
logger.level = 'debug';

// Configure Google API key
if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY environment variable must be set');
}

async function main() {
  let client: MultiServerMCPClient | undefined;

  try {
    // Create MCP client and connect to math server (using a simple example server)
    client = new MultiServerMCPClient();
    await client.connectToServerViaStdio('math-server', 'python', ['./examples/math_server.py']);
    console.log('Connected to MCP server');

    // Get tools
    const tools = Array.from(client.getTools().values()).flat();
    console.log(
      'Available tools:',
      tools.map(t => t.name)
    );

    // Create Gemini LLM instance
    const llm = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: 'gemini-2.0-flash',
      temperature: 0,
    });

    // APPROACH 1: Using standard agent (RECOMMENDED)
    // This approach consistently works with MCP tools
    console.log('\n--- APPROACH 1: Standard Agent (RECOMMENDED) ---');
    console.log('Creating standard agent...');
    const standardExecutor = await initializeAgentExecutorWithOptions(tools, llm, {
      agentType: 'chat-zero-shot-react-description',
      verbose: true,
    });

    // Test the agent with a simple math query
    console.log('Running standard agent...');
    try {
      const standardResult = await standardExecutor.invoke({
        input: 'What is 5 plus 3?',
      });
      console.log('Standard agent result:', standardResult);
    } catch (error) {
      console.error('Error with standard agent:', error);
    }

    // APPROACH 2: Using React agent (NOT RECOMMENDED with MCP tools)
    // This approach often fails due to compatibility issues
    console.log('\n--- APPROACH 2: React Agent (NOT RECOMMENDED) ---');
    console.log('Creating React agent...');
    // Create a ToolNode
    const toolsNode = new ToolNode(tools);

    try {
      // Note: This will likely fail with Gemini if any tools have empty schemas
      // It may also fail with other LLMs due to React agent implementation requirements
      const reactAgent = await createReactAgent({
        llm,
        tools: toolsNode,
      });

      console.log('Running React agent...');
      const reactResult = await reactAgent.invoke({
        messages: [new HumanMessage('What is 5 plus 3?')],
      });

      console.log('React agent result:', reactResult);
    } catch (error) {
      console.error('Error with React agent:');
      console.error('This is an expected error - React agents have specific requirements');
      console.error('RECOMMENDATION: Use standard agents (Approach 1) instead with MCP tools');
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
    }
  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  } finally {
    // Close the client
    if (client) {
      await client.close();
      console.log('Client closed');
    }
  }
}

main().catch(console.error);
