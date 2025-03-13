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
    console.log('\n=== CREATING LANGGRAPH AGENT FLOW ===');

    // Define the function that calls the model
    const llmNode = async (state: typeof MessagesAnnotation.State) => {
      console.log(`Calling LLM with ${state.messages.length} messages`);

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
        console.log('Tool calls detected, routing to tools node');

        // Log what tools are being called
        const toolNames = aiMessage.tool_calls.map(tc => tc.name).join(', ');
        console.log(`Tools being called: ${toolNames}`);

        return 'tools' as any;
      }

      // If there are no tool calls, we're done
      console.log('No tool calls, ending the workflow');
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
      console.log(`\n--- Example: ${example.name} ---`);
      console.log(`Query: ${example.query}`);

      // Run the LangGraph agent
      const result = await app.invoke({
        messages: [new HumanMessage(example.query)],
      });

      // Display the final answer
      const finalMessage = result.messages[result.messages.length - 1];
      console.log(`\nResult: ${finalMessage.content}`);

      // Let's list the directory to see the changes
      console.log('\nDirectory listing after operations:');
      try {
        const listResult = await app.invoke({
          messages: [
            new HumanMessage(
              'List all files and directories in the current directory and show their structure.'
            ),
          ],
        });
        const listMessage = listResult.messages[listResult.messages.length - 1];
        console.log(listMessage.content);
      } catch (error) {
        console.error('Error listing directory:', error);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close all client connections
    if (client) {
      await client.close();
      console.log('\nClosed all connections');
    }

    // Exit process with successful code
    console.log('Example execution completed successfully.');
    setTimeout(() => process.exit(0), 100); // Small delay to ensure logs are printed
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
  }
}

// Set up test directory and run the example
setupTestDirectory()
  .then(() => runExample())
  .catch(error => console.error('Setup error:', error));
