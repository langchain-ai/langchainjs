/**
 * Test file to compare React agent behavior with OpenAI vs Gemini models
 *
 * This example tests if the React agent works with OpenAI models when using MCP tools.
 */

import { MultiServerMCPClient } from '../src/index.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ToolNode, createReactAgent } from '@langchain/langgraph/prebuilt';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import dotenv from 'dotenv';
import logger from '../src/logger.js';

// Load environment variables from .env file
dotenv.config();

// Set logger level to see verbose output
logger.level = 'debug';

// Create a simple mock LLM for testing purposes
class MockChatModel extends BaseChatModel {
  _llmType(): string {
    return 'mock';
  }

  async _generate(messages: Array<any>, _options: Record<string, unknown>) {
    return {
      generations: [
        {
          message: new AIMessage({
            content:
              'I\'ll use the add tool to calculate 5 + 3.\nAction: add\nAction Input: {"a": 5, "b": 3}\nObservation: 8\nThought: Now I know the answer.\nFinal Answer: 8',
          }),
          text: 'I\'ll use the add tool to calculate 5 + 3.\nAction: add\nAction Input: {"a": 5, "b": 3}\nObservation: 8\nThought: Now I know the answer.\nFinal Answer: 8',
        },
      ],
    };
  }
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

    console.log('\n--- Testing React Agent with Mock LLM ---');
    console.log('This test will verify if the tools are structured correctly for any LLM');

    // Create a Mock LLM for testing
    const mockLLM = new MockChatModel({});

    // Create React agent
    console.log('Creating React agent...');

    // Create a ToolNode
    const toolsNode = new ToolNode(tools);

    try {
      // Test if React agent works with the mock LLM
      const reactAgent = await createReactAgent({
        llm: mockLLM,
        tools: toolsNode,
      });

      console.log('Running React agent...');
      const reactResult = await reactAgent.invoke({
        messages: [new HumanMessage('What is 5 plus 3?')],
      });

      console.log('React agent result:', reactResult);
      console.log('SUCCESS: React agent works with the tools structure!');
      console.log(
        'This suggests the issue is specific to Gemini and its expectations for tool schemas.'
      );
    } catch (error) {
      console.error('Error with React agent using Mock LLM:');
      console.error(
        'This suggests the issue is with the React agent and tools structure, not just Gemini'
      );
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
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
