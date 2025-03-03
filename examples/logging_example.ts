/**
 * This example demonstrates how to use the built-in Winston logger with the MCP adapter.
 *
 * To run this example:
 * 1. Start the math server: python examples/math_server.py
 * 2. Start the weather server: python examples/weather_server.py
 * 3. Run this example: node --loader ts-node/esm examples/logging_example.ts
 */

import { MultiServerMCPClient, logger } from '../src/index.js';

// Set log level to debug for more verbose output
// This is the default in development mode
// In production mode, the default is 'info'
process.env.NODE_ENV = 'development';

async function main() {
  logger.info('Starting logging example');

  // Create a client with connections to both the math and weather servers
  logger.info('Creating MCP client with connections to math and weather servers');
  const client = new MultiServerMCPClient({
    math: {
      command: 'python',
      args: ['examples/math_server.py'],
    },
    weather: {
      transport: 'sse',
      url: 'http://localhost:8000/sse',
    },
  });

  try {
    // Initialize connections to all servers
    logger.info('Initializing connections to servers');
    const serverTools = await client.initializeConnections();

    // Log the available tools from each server
    // Use Array.from to convert the Map entries to an array
    Array.from(serverTools.keys()).forEach(serverName => {
      const tools = serverTools.get(serverName) || [];
      logger.info(`Server "${serverName}" has ${tools.length} tools available:`);
      tools.forEach(tool => {
        logger.info(`  - ${tool.name}: ${tool.description}`);
      });
    });

    // Get the math tools
    const mathTools = serverTools.get('math') || [];
    if (mathTools.length > 0) {
      // Find the add tool
      const addTool = mathTools.find(tool => tool.name === 'add');
      if (addTool) {
        logger.debug('Calling add tool with numbers 5 and 7');
        const result = await addTool.invoke({ a: 5, b: 7 });
        logger.info(`Result of 5 + 7 = ${result}`);
      } else {
        logger.warn('Add tool not found in math server');
      }
    } else {
      logger.error('No tools found for math server');
    }

    // Get the weather tools
    const weatherTools = serverTools.get('weather') || [];
    if (weatherTools.length > 0) {
      // Find the temperature tool
      const tempTool = weatherTools.find(tool => tool.name === 'get_temperature');
      if (tempTool) {
        logger.debug('Calling temperature tool for San Francisco');
        const result = await tempTool.invoke({ city: 'San Francisco' });
        logger.info(`Temperature in San Francisco: ${result}`);
      } else {
        logger.warn('Temperature tool not found in weather server');
      }
    } else {
      logger.error('No tools found for weather server');
    }

    // Demonstrate different log levels
    logger.error('This is an error message - will appear in error.log and all.log');
    logger.warn('This is a warning message');
    logger.info('This is an info message');
    logger.http('This is an HTTP message');
    logger.debug('This is a debug message - only visible in development mode');

    // Close all connections
    logger.info('Closing all connections');
    await client.close();

    logger.info('Logging example completed successfully');
  } catch (error) {
    logger.error(`Error in logging example: ${error}`);
  }
}

main().catch(error => {
  logger.error(`Unhandled error in main: ${error}`);
  process.exit(1);
});
