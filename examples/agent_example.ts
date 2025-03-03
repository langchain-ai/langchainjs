import { MultiServerMCPClient } from '../src/client.js';
import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIFunctionsAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * This example demonstrates how to use MCP tools with a LangChain agent.
 *
 * It connects to both a math server and a weather server, retrieves the available tools,
 * and creates an agent that can use these tools to solve problems.
 *
 * Note: You need to set the OPENAI_API_KEY environment variable to run this example.
 */
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Please set the OPENAI_API_KEY environment variable in the .env file');
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

    // Create an agent
    console.log('\nCreating agent...');
    const model = new ChatOpenAI({
      temperature: 0,
      modelName: 'gpt-4o', // or any other model that supports function calling
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        "You are a helpful assistant that can perform calculations and get weather information. Use the tools available to you to answer the user's questions.",
      ],
      ['human', '{input}'],
    ]);

    const agent = await createOpenAIFunctionsAgent({
      llm: model,
      tools: allTools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools: allTools,
    });

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
      const result = await agentExecutor.invoke({
        input: query,
      });
      console.log(`Answer: ${result.output}`);
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
