/**
 * Filesystem MCP Server Agent Example
 *
 * This example demonstrates how to use the Filesystem MCP server with LangChain agents
 * to perform file operations such as writing files and reading multiple files together.
 *
 * The Filesystem MCP server provides tools for:
 * - Reading files (single and multiple)
 * - Writing files
 * - Editing files
 * - Directory operations (create, list, move)
 * - File search and metadata
 */

import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import dotenv from 'dotenv';
import logger from '../src/logger.js';
import fs from 'fs';
import path from 'path';

// MCP client imports
import { MultiServerMCPClient } from '../src/index.js';

// Load environment variables from .env file
dotenv.config();

/**
 * OpenAI Functions Agent example with Filesystem MCP server
 * This example demonstrates reading and writing files
 */
async function runFunctionsAgentExample() {
  let client: MultiServerMCPClient | null = null;

  try {
    logger.info('Initializing MCP client...');

    // Create a test directory
    const testDir = path.join('./examples', 'filesystem_test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
      console.log(`Created test directory: ${testDir}`);
    }

    // Create a client with configurations for the filesystem server
    // In a real environment, you would connect to the actual server
    // For this example, we're using a stand-in server path
    client = new MultiServerMCPClient({
      filesystem: {
        transport: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          './examples/filesystem_test', // This directory needs to exist
        ],
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
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      temperature: 0,
    });

    // Create a prompt for the agent
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an assistant that helps users with file operations.
You have access to tools that can read and write files, create directories,
and perform other filesystem operations. Be careful with file operations,
especially writing and editing files. Always confirm the content and path before
making changes.

For file writing operations, format the content properly based on the file type.
For reading multiple files, you can use the read_multiple_files tool.

IMPORTANT: You can only access files in the allowed directories. Use the list_allowed_directories tool to see which directories you can access.
When creating or accessing files, always use the full path to ensure you're in the allowed directories.`,
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    // Create the agent
    const agent = await createOpenAIFunctionsAgent({
      llm: model,
      tools: mcpTools,
      prompt,
    });

    // Create the agent executor
    const agentExecutor = new AgentExecutor({
      agent,
      tools: mcpTools,
    });

    // Get the allowed directories first
    const allowedDirectoriesResult = await agentExecutor.invoke({
      input:
        'What directories am I allowed to access? Use the list_allowed_directories tool to check.',
      chat_history: [],
    });

    console.log('\nAllowed directories:', allowedDirectoriesResult.output);

    // Example 1: Write a file
    console.log('\n=== Example 1: Write a file ===');

    const fileWriteResult = await agentExecutor.invoke({
      input:
        'Create a file called "hello.txt" with the content "Hello, World!" in the filesystem_test directory.',
      chat_history: [],
    });

    console.log('Agent output:', fileWriteResult.output);

    // Example 2: Write a JSON file
    console.log('\n=== Example 2: Write a JSON file ===');

    const jsonWriteResult = await agentExecutor.invoke({
      input:
        'Create a JSON file called "config.json" in the filesystem_test directory with the following structure: {"name": "test", "version": "1.0.0", "description": "Test configuration file"}',
      chat_history: [new HumanMessage('I want to create some configuration files.')],
    });

    console.log('Agent output:', jsonWriteResult.output);

    // Example 3: Read multiple files
    console.log('\n=== Example 3: Read multiple files ===');

    const readMultipleResult = await agentExecutor.invoke({
      input:
        'Read the content of both "hello.txt" and "config.json" files in the filesystem_test directory and summarize what they contain.',
      chat_history: [new HumanMessage('I created some files earlier.')],
    });

    console.log('Agent output:', readMultipleResult.output);

    // Example 4: Create a directory and write a file in it
    console.log('\n=== Example 4: Create a directory and write a file in it ===');

    const createDirResult = await agentExecutor.invoke({
      input:
        'Create a directory called "data" inside the filesystem_test directory and write a file called "info.txt" in that directory with the content "This is a test file in the data directory."',
      chat_history: [],
    });

    console.log('Agent output:', createDirResult.output);

    // Example 5: Search for files
    console.log('\n=== Example 5: Search for files ===');

    const searchResult = await agentExecutor.invoke({
      input: 'Search for all .txt files in the filesystem_test directory and its subdirectories.',
      chat_history: [],
    });

    console.log('Agent output:', searchResult.output);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close all client connections
    if (client) {
      await client.close();
      console.log('\nClosed all connections');
    }
  }
}

// Run the example
runFunctionsAgentExample().catch(error => console.error('Setup error:', error));
