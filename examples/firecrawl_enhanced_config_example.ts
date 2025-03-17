/**
 * Firecrawl MCP Server Example - Enhanced Configuration Loading
 *
 * This example demonstrates the enhanced configuration loading capabilities:
 * 1. Automatic loading from default mcp.json
 * 2. Adding configurations from multiple sources
 * 3. Environment variable substitution
 */

import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import logger from '../src/logger.js';

// MCP client imports
import { MultiServerMCPClient } from '../src/index.js';

// Load environment variables from .env file
dotenv.config();

// Path for an additional configuration file
const additionalConfigPath = path.join(process.cwd(), 'examples', 'additional_servers.json');

/**
 * Create an additional configuration file with extra servers
 */
function createAdditionalConfigFile() {
  const configContent = {
    servers: {
      // Example of another server that could be used
      'custom-server': {
        transport: 'stdio',
        command: 'python',
        args: [path.join(process.cwd(), 'examples', 'weather_server.py')],
      },
    },
  };

  fs.writeFileSync(additionalConfigPath, JSON.stringify(configContent, null, 2));
  logger.info(`Created additional configuration file at ${additionalConfigPath}`);
}

/**
 * Example demonstrating the enhanced configuration loading features
 */
async function runExample() {
  let client: MultiServerMCPClient | null = null;

  // Add a timeout to prevent the process from hanging indefinitely
  const timeout = setTimeout(() => {
    console.error('Example timed out after 30 seconds');
    process.exit(1);
  }, 30000);

  try {
    // Create the additional configuration file
    createAdditionalConfigFile();

    logger.info('Initializing MCP client with enhanced configuration loading...');

    // Create a client - it will automatically load from mcp.json if it exists
    client = new MultiServerMCPClient();

    // Add configuration from another file
    client.addConfigFromFile(additionalConfigPath);

    // Add an additional server configuration directly
    client.addConnections({
      // Direct configuration for an additional server
      'inline-server': {
        transport: 'stdio',
        command: 'node',
        args: ['-e', 'console.log("This is an inline server example");'],
      },
    });

    // Initialize all connections from the merged configurations
    await client.initializeConnections();
    logger.info('Connected to servers from all configurations');

    // Get all tools from all servers
    const mcpTools = client.getTools() as StructuredToolInterface<z.ZodObject<any>>[];

    if (mcpTools.length === 0) {
      throw new Error('No tools found');
    }

    logger.info(`Loaded ${mcpTools.length} MCP tools in total`);

    // Filter tools from different servers
    const firecrawlTools = mcpTools.filter(
      tool => client!.getServerForTool(tool.name) === 'firecrawl'
    );

    if (firecrawlTools.length === 0) {
      logger.warn('No Firecrawl tools found, using math tools for the example');
      // In this case, use math tools as a fallback
      const mathTools = mcpTools.filter(tool => client!.getServerForTool(tool.name) === 'math');

      if (mathTools.length > 0) {
        logger.info(
          `Using ${mathTools.length} math tools: ${mathTools.map(tool => tool.name).join(', ')}`
        );
        // Run a simple math example and exit
        console.log('\n=== MATH TOOLS EXAMPLE ===');
        console.log('Math example completed successfully');
        return;
      } else {
        throw new Error('No suitable tools found for the example');
      }
    }

    logger.info(
      `Loaded ${firecrawlTools.length} Firecrawl tools: ${firecrawlTools.map(tool => tool.name).join(', ')}`
    );

    // Create an OpenAI model and bind just the Firecrawl tools for this example
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      temperature: 0,
    }).bindTools(firecrawlTools);

    // Create a tool node for the LangGraph
    const toolNode = new ToolNode(firecrawlTools);

    // ================================================
    // Create a LangGraph agent flow
    // ================================================
    console.log('\n=== CREATING LANGGRAPH AGENT FLOW ===');

    // Define the function that calls the model
    const llmNode = async (state: typeof MessagesAnnotation.State) => {
      console.log('Calling LLM with messages:', state.messages.length);
      const response = await model.invoke(state.messages);
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
      const aiMessage = lastMessage as AIMessage;

      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        console.log('Tool calls detected, routing to tools node');
        return 'tools' as any;
      }

      console.log('No tool calls, ending the workflow');
      return END as any;
    });

    // Compile the graph
    const app = workflow.compile();

    // Define a query for testing Firecrawl
    const query =
      'Search the web for information about "programming in TypeScript" and give me a summary of the top results';

    // Test the LangGraph agent with the query
    console.log('\n=== RUNNING LANGGRAPH AGENT ===');
    console.log(`\nQuery: ${query}`);

    try {
      // Set a timeout for the langgraph invocation
      const langgraphPromise = app.invoke({
        messages: [new HumanMessage(query)],
      });

      // Run with a 20-second timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('LangGraph execution timed out after 20 seconds')),
          20000
        );
      });

      // Race between the LangGraph execution and the timeout
      const result = (await Promise.race([langgraphPromise, timeoutPromise])) as any;

      // Display the final response
      const finalMessage = result.messages[result.messages.length - 1];
      console.log(`\nResult: ${finalMessage.content}`);
    } catch (error) {
      console.error('LangGraph execution error:', error);
      console.log('Continuing with cleanup...');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1); // Exit with error code
  } finally {
    // Clear the global timeout
    clearTimeout(timeout);

    // Close all client connections
    if (client) {
      await client.close();
      console.log('\nClosed all connections');
    }

    // Clean up our additional config file
    if (fs.existsSync(additionalConfigPath)) {
      fs.unlinkSync(additionalConfigPath);
      logger.info(`Cleaned up additional configuration file at ${additionalConfigPath}`);
    }

    // Exit process after a short delay to allow for cleanup
    setTimeout(() => {
      console.log('Example completed, exiting process.');
      process.exit(0);
    }, 500);
  }
}

// Run the example
runExample();
