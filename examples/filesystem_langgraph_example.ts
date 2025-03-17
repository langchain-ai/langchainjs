/**
 * Filesystem MCP Server with LangGraph Example
 *
 * This example demonstrates how to use the Filesystem MCP server with LangGraph
 * to create a structured workflow for complex file operations.
 *
 * The graph-based approach allows:
 * 1. Clear separation of responsibilities (reasoning vs execution)
 * 2. Conditional routing based on file operation types
 * 3. Structured handling of complex multi-file operations
 */

import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
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
 * Example demonstrating how to use MCP filesystem tools with LangGraph agent flows
 * This example focuses on file operations like reading multiple files and writing files
 */
async function runExample() {
  let client: MultiServerMCPClient | null = null;

  try {
    logger.info('Initializing MCP client...');

    // Create a client with configurations for the filesystem server
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

    // Create an OpenAI model with tools attached
    const systemMessage = `You are an assistant that helps users with file operations.
You have access to tools that can read and write files, create directories,
and perform other filesystem operations. Be careful with file operations,
especially writing and editing files. Always confirm the content and path before
making changes.

For file writing operations, format the content properly based on the file type.
For reading multiple files, you can use the read_multiple_files tool.`;

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo-preview',
      temperature: 0,
    }).bindTools(mcpTools);

    // Create a tool node for the LangGraph
    const toolNode = new ToolNode(mcpTools);

    // ================================================
    // Create a LangGraph agent flow
    // ================================================
    logger.info('\n=== CREATING LANGGRAPH AGENT FLOW ===');

    // Define the function that calls the model
    const llmNode = async (state: typeof MessagesAnnotation.State) => {
      logger.info(`Calling LLM with ${state.messages.length} messages`);

      // Add system message if it's the first call
      let messages = state.messages;
      if (messages.length === 1 && messages[0] instanceof HumanMessage) {
        messages = [new SystemMessage(systemMessage), ...messages];
      }

      const response = await model.invoke(messages);
      return { messages: [response] };
    };

    // Create a new graph with MessagesAnnotation
    const workflow = new StateGraph(MessagesAnnotation);

    // Add the nodes to the graph
    workflow.addNode('llm', llmNode);
    workflow.addNode('tools', toolNode);

    // Add edges - these define how nodes are connected
    workflow.addEdge(START as any, 'llm' as any);
    workflow.addEdge('tools' as any, 'llm' as any);

    // Conditional routing to end or continue the tool loop
    workflow.addConditionalEdges('llm' as any, state => {
      const lastMessage = state.messages[state.messages.length - 1];

      // Cast to AIMessage to access tool_calls property
      const aiMessage = lastMessage as AIMessage;
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        logger.info('Tool calls detected, routing to tools node');

        // Log what tools are being called
        const toolNames = aiMessage.tool_calls.map(tc => tc.name).join(', ');
        logger.info(`Tools being called: ${toolNames}`);

        return 'tools' as any;
      }

      // If there are no tool calls, we're done
      logger.info('No tool calls, ending the workflow');
      return END as any;
    });

    // Compile the graph
    const app = workflow.compile();

    // Define examples to run
    const examples = [
      {
        name: 'Write multiple files',
        query:
          "Create two files: 'notes.txt' with content 'Important meeting on Thursday' and 'reminder.txt' with content 'Call John about the project'.",
      },
      {
        name: 'Read multiple files',
        query:
          "Read both notes.txt and reminder.txt files and create a summary file called 'summary.txt' that contains information from both files.",
      },
      {
        name: 'Create directory structure',
        query:
          "Create a directory structure for a simple web project. Make a 'project' directory with subdirectories for 'css', 'js', and 'images'. Add an index.html file in the main project directory with a basic HTML5 template.",
      },
      {
        name: 'Search and organize',
        query:
          "Search for all .txt files and create a new directory called 'text_files', then list the names of all found text files in a new file called 'text_files/index.txt'.",
      },
    ];

    // Run the examples
    console.log('\n=== RUNNING LANGGRAPH AGENT ===');

    for (const example of examples) {
      logger.info(`\n--- Example: ${example.name} ---`);
      logger.info(`Query: ${example.query}`);

      // Run the LangGraph agent
      const result = await app.invoke({
        messages: [new HumanMessage(example.query)],
      });

      // Display the final answer
      const finalMessage = result.messages[result.messages.length - 1];
      logger.info(`\nResult: ${finalMessage.content}`);

      // Let's list the directory to see the changes
      logger.info('\nDirectory listing after operations:');
      try {
        const listResult = await app.invoke({
          messages: [
            new HumanMessage(
              'List all files and directories in the current directory and show their structure.'
            ),
          ],
        });
        const listMessage = listResult.messages[listResult.messages.length - 1];
        logger.info(listMessage.content);
      } catch (error) {
        logger.error('Error listing directory:', error);
      }
    }
  } catch (error) {
    logger.error('Error:', error);
    process.exit(1); // Exit with error code
  } finally {
    if (client) {
      await client.close();
      logger.info('Closed all MCP connections');
    }

    // Exit process after a short delay to allow for cleanup
    setTimeout(() => {
      logger.info('Example completed, exiting process.');
      process.exit(0);
    }, 500);
  }
}

/**
 * Create a directory for our tests if it doesn't exist yet
 */
async function setupTestDirectory() {
  const testDir = path.join('./examples', 'filesystem_test');

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
    logger.info(`Created test directory: ${testDir}`);
  }
}

// Set up test directory and run the example
setupTestDirectory()
  .then(() => runExample())
  .catch(error => logger.error('Setup error:', error));
