/**
 * Filesystem MCP Server with React Agent Example
 *
 * This example demonstrates how to use the Filesystem MCP server with a React agent.
 * React agents follow a structured thought process:
 * 1. Think about the problem
 * 2. Select an appropriate action
 * 3. Take the action
 * 4. Observe the result
 * 5. Repeat until the task is complete
 */

import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AgentExecutor, createReactAgent } from 'langchain/agents';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  AIMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import dotenv from 'dotenv';
import logger from '../src/logger.js';
import fs from 'fs';
import path from 'path';
import { mkdir, rm } from 'fs/promises';

// MCP client imports
import { MultiServerMCPClient } from '../src/index.js';

// Load environment variables from .env file
dotenv.config();

// Define paths and constants
const ALLOWED_DIR = './examples/filesystem_test';

/**
 * React Agent example with Filesystem MCP server
 * This example demonstrates complex file operations
 */
async function runReactAgentExample() {
  let client: MultiServerMCPClient | null = null;

  try {
    // Set up test directory and clean it
    await setupTestDirectory();

    console.log('Creating and initializing the MCP Client...');

    // Create and initialize the MCP Client with a stdio transport for the filesystem server
    client = new MultiServerMCPClient({
      filesystem: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', ALLOWED_DIR],
      },
    });

    // Initialize the client connection and get all available tools
    await client.initializeConnections();
    const tools = client.getTools();

    console.log(`Loaded ${tools.length} tools from filesystem server`);

    // Create a prompt template for the React agent
    const reactPromptTemplate = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `You are a helpful assistant that helps with filesystem operations.
        
IMPORTANT: You can ONLY access files within the "./examples/filesystem_test" directory.
All paths should be RELATIVE to this allowed directory.

For file writing operations, format the content properly based on the file type.
For reading multiple files, you can use the read_multiple_files tool.

Always provide parameters in proper JSON format with correct fields when using tools.
DO NOT use code blocks or markdown formatting in your Action Input.

You have access to the following tools:
{tools}

Available tool names: {tool_names}

This is the format you must follow:
Question: The input question you must answer
Thought: You should always think about what to do
Action: The action to take, should be one of the tool names: {tool_names}
Action Input: The input to the action as a valid JSON object
Observation: The result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: The final answer to the original input question`
      ),
      HumanMessagePromptTemplate.fromTemplate('{input}'),
      AIMessagePromptTemplate.fromTemplate('{agent_scratchpad}'),
    ]);

    // Create a React style agent
    console.log('Creating React agent...');
    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
    });

    // Create the React agent with tools and prompt
    const reactAgent = await createReactAgent({
      llm: model,
      tools,
      prompt: reactPromptTemplate,
    });

    // Create the agent executor
    const executor = new AgentExecutor({
      agent: reactAgent,
      tools,
      verbose: true,
      maxIterations: 15,
    });

    console.log('Running agent to create and read files...');

    // Handle gracefully if there's an issue
    try {
      // First check if we can access allowed directories
      const checkResult = await executor.invoke({
        input:
          'What directories am I allowed to access? Please provide the list of allowed directories using the list_allowed_directories tool.',
      });
      console.log('Initial check result:', checkResult.output);

      // Create files and read them
      const result = await executor.invoke({
        input:
          "Create two files: a file named 'planets1.txt' with content about Mars (include facts about its atmosphere, size, and moons), and a file named 'planets2.txt' with content about Jupiter (include facts about its atmosphere, size, and moons). Then read both files and create a new 'summary.txt' file that combines and summarizes the information from both planets.",
      });
      console.log('Agent output:', result.output);
    } catch (error) {
      console.error('Error in React agent:', error);
    }

    // Show directory listing regardless of whether the main task succeeded
    console.log('\nDirectory listing after operations:');
    try {
      const listResult = await executor.invoke({
        input:
          'List all files and directories in the current allowed directory and show their content.',
      });
      console.log('Directory listing:', listResult.output);
    } catch (error) {
      console.error('Error listing directory:', error);
    }

    // Let's verify by checking the directory directly
    const filesInDir = fs.readdirSync(ALLOWED_DIR);
    console.log('\nActual files in directory from fs.readdirSync:', filesInDir);

    // Read any text files found
    for (const file of filesInDir) {
      if (file.endsWith('.txt')) {
        try {
          const content = fs.readFileSync(path.join(ALLOWED_DIR, file), 'utf8');
          console.log(`\nContent of ${file}:`);
          console.log(content.substring(0, 200) + (content.length > 200 ? '...' : ''));
        } catch (err) {
          console.error(`Error reading ${file}:`, err);
        }
      }
    }

    console.log('\nClosed all connections');
    console.log('Example execution completed successfully.');
  } catch (error) {
    console.error('Error running example:', error);
  } finally {
    // Close all connections
    if (client) {
      await client.close();
    }
  }
}

/**
 * Create a directory for our tests if it doesn't exist yet
 */
async function setupTestDirectory() {
  const testDir = path.join('./examples', 'filesystem_test');

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
    console.log(`Created test directory: ${testDir}`);
  } else {
    // Clean the directory to start fresh for each run
    try {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        const filePath = path.join(testDir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          fs.rmdirSync(filePath, { recursive: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
      console.log(`Cleaned test directory: ${testDir}`);
    } catch (error) {
      console.error('Error cleaning directory:', error);
    }
  }

  // Add a test file to verify write permissions
  try {
    fs.writeFileSync(
      path.join(testDir, 'test_file.txt'),
      'This is a test file to verify write permissions'
    );
    console.log('Created test file to verify permissions');
  } catch (error) {
    console.error('Error creating test file:', error);
  }
}

// Set up test directory and run the example
setupTestDirectory()
  .then(() => runReactAgentExample())
  .then(() => {
    console.log('Example execution completed successfully.');
    // Add explicit process exit to ensure the script terminates
    setTimeout(() => {
      console.log('Exiting process...');
      process.exit(0);
    }, 0);
  })
  .catch(error => {
    console.error('Failed to run example:', error);
    process.exit(1);
  });
