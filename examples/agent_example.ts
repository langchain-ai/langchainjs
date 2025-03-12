import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent, createReactAgent } from 'langchain/agents';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  AIMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import dotenv from 'dotenv';
import logger from '../src/logger.js';

// MCP client imports
import { MultiServerMCPClient } from '../src/index.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Example demonstrating how to use MCP tools with LangChain agents
 * This example connects to a math server and uses its tools
 */
async function runExample() {
  try {
    logger.info('Initializing MCP client...');

    // Create a client with configurations for the math server only
    const client = new MultiServerMCPClient({
      math: {
        transport: 'stdio',
        command: 'python',
        args: ['./examples/math_server.py'],
      },
    });

    // Initialize connections to the server
    await client.initializeConnections();
    logger.info('Connected to server');

    // Get all tools (flattened array is the default now)
    const mcpTools = client.getTools() as StructuredToolInterface<z.ZodObject<any>>[];

    if (mcpTools.length === 0) {
      throw new Error('No tools found');
    }

    logger.info(
      `Loaded ${mcpTools.length} MCP tools: ${mcpTools.map(tool => tool.name).join(', ')}`
    );

    // Create an OpenAI model
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo-preview',
      temperature: 0,
    });

    // Define queries for testing
    const queries = ['What is 5 + 3?', 'What is 7 * 9?'];

    // ================================================
    // Create an OpenAI Functions Agent
    // ================================================
    console.log('\n=== CREATING OPENAI FUNCTIONS AGENT ===');

    // Create a prompt template for the OpenAI Functions agent
    const openAIFunctionsPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a helpful assistant that can solve math problems using tools.
        
When you need to perform a calculation, use the appropriate math tool.
For the add tool, provide parameters in the correct format with "a" and "b" values.
For the multiply tool, provide parameters in the correct format with "a" and "b" values.

Always use the tools when calculations are needed.`,
      ],
      ['human', '{input}'],
      ['ai', '{agent_scratchpad}'],
    ]);

    // Create the OpenAI Functions agent
    const openAIFunctionsAgent = await createOpenAIFunctionsAgent({
      llm: model,
      tools: mcpTools,
      prompt: openAIFunctionsPrompt,
    });

    // Create an agent executor for the OpenAI Functions agent
    const openAIExecutor = new AgentExecutor({
      agent: openAIFunctionsAgent,
      tools: mcpTools,
      verbose: true,
      maxIterations: 3, // Limit iterations for demo purposes
    });

    // ================================================
    // Create a React Agent
    // ================================================
    console.log('\n=== CREATING REACT AGENT ===');

    // Create a prompt template for the React agent
    const reactPromptTemplate = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `You are a helpful assistant that can solve math problems using tools.
        
When you need to perform a calculation, use the appropriate math tool.
For the add tool, provide the parameters in JSON format when using tools.
For the multiply tool, provide the parameters in JSON format when using tools.

Always use the tools when calculations are needed.

You have access to the following tools:
{tools}

Available tool names: {tool_names}

This is the format you must follow:
Question: The input question you must answer
Thought: You should always think about what to do
Action: The action to take, should be one of the tool names: add, multiply
Action Input: The input to the action as a valid JSON object with keys "a" and "b"
Observation: The result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: The final answer to the original input question`
      ),
      HumanMessagePromptTemplate.fromTemplate('{input}'),
      AIMessagePromptTemplate.fromTemplate('{agent_scratchpad}'),
    ]);

    // Create React agent
    console.log('Creating React agent...');
    const reactAgent = await createReactAgent({
      llm: model,
      tools: mcpTools,
      prompt: reactPromptTemplate,
    });

    // Create an agent executor for the React agent
    const reactExecutor = new AgentExecutor({
      agent: reactAgent,
      tools: mcpTools,
      verbose: true,
    });

    // ================================================
    // Test queries
    // ================================================

    // Run the OpenAI Functions agent
    console.log('\n=== RUNNING OPENAI FUNCTIONS AGENT ===');
    for (const query of queries) {
      console.log(`\n--- Query: "${query}" ---`);
      try {
        const result = await openAIExecutor.invoke({
          input: query,
        });
        console.log(`Answer: ${result.output}`);
      } catch (error) {
        console.error(`Error processing query "${query}":`, error);
      }
    }

    // Run the React agent
    console.log('\n=== RUNNING REACT AGENT ===');
    for (const query of queries) {
      console.log(`\n--- Query: "${query}" ---`);
      try {
        const result = await reactExecutor.invoke({
          input: query,
        });
        console.log(`Answer: ${result.output}`);
      } catch (error) {
        console.error(`Error processing query "${query}":`, error);
      }
    }

    // Close the client when done
    console.log('\nClosing client...');
    await client.close();
    logger.info('Client closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the example
runExample();
