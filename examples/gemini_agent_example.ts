import { MultiServerMCPClient } from '../src/client.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * This example demonstrates how to use MCP tools with a LangChain agent using Google's Gemini model.
 *
 * It connects to both a math server and a weather server, retrieves the available tools,
 * and creates an agent that can use these tools to solve problems.
 *
 * Note: You need to set the GOOGLE_API_KEY environment variable in the .env file to run this example.
 */
async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error('Please set the GOOGLE_API_KEY environment variable in the .env file');
    process.exit(1);
  }

  // Create a client with configurations for both servers
  const client = new MultiServerMCPClient({
    math: {
      transport: 'stdio',
      command: 'python',
      args: ['./examples/math_server.py'],
    },
    weather: {
      transport: 'stdio',
      command: 'python',
      args: ['./examples/weather_server.py'],
    },
  });

  try {
    // Initialize connections to both servers
    console.log('Initializing connections to servers...');
    await client.initializeConnections();
    console.log('Connected to servers');

    // Get all tools from all servers
    const serverTools = client.getTools();

    // Flatten all tools for use with the agent
    const allTools = Array.from(serverTools.values()).flat();
    console.log(`Available tools: ${allTools.map(tool => tool.name).join(', ')}`);

    // Print tool descriptions
    console.log('Tool descriptions:');
    for (const [serverName, tools] of serverTools.entries()) {
      console.log(`\nServer: ${serverName}`);
      for (const tool of tools) {
        console.log(`- ${tool.name}: ${tool.description}`);
      }
    }

    // Create an agent
    console.log('\nCreating agent...');
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: 'gemini-2.0-flash',
      temperature: 0,
    });

    // Initialize the agent executor with a simple agent type
    // Add a type assertion to work around version incompatibility issues
    const executor = await initializeAgentExecutorWithOptions(
      // @ts-expect-error Type assertion to work around version incompatibility issues
      allTools,
      model,
      {
        agentType: 'chat-zero-shot-react-description',
        verbose: true,
      }
    );

    // Run the agent with different queries
    const queries = [
      'What is 5 + 3?',
      'What is 7 * 9?',
      "What's the current temperature in Tokyo?",
      "What's the 3-day forecast for London?",
      "If it's 72°F in New York, what is that in Celsius?",
    ];

    for (const query of queries) {
      console.log(`\n--- Query: "${query}" ---`);
      try {
        const result = await executor.invoke({
          input: query,
        });
        console.log(`Answer: ${result.output}`);
      } catch (error) {
        console.error(`Error processing query "${query}":`, error);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the client
    console.log('\nClosing client...');
    await client.close();
    console.log('Client closed');
  }
}

main().catch(console.error);
