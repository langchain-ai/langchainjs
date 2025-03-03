import { MultiServerMCPClient } from '../src/client.js';

/**
 * This example demonstrates how to use the MCP adapter with an SSE server.
 *
 * Before running this example, you need to:
 *
 * 1. Start the weather server with SSE transport:
 *    python examples/weather_server.py
 *
 * 2. Then run this example with:
 *    node --loader ts-node/esm examples/sse_example.ts
 */
async function main() {
  try {
    // Create a client with a connection to the weather server
    const client = new MultiServerMCPClient({
      weather: {
        transport: 'sse',
        url: 'http://localhost:8000/sse',
      },
    });

    // Initialize the connection
    console.log('Connecting to weather server via SSE...');
    const serverTools = await client.initializeConnections();
    console.log('Connected to weather server');

    // Get the weather tools
    const weatherTools = serverTools.get('weather') || [];
    console.log(`Available tools: ${weatherTools.map(tool => tool.name).join(', ')}`);
    console.log(`Tool descriptions:`);
    for (const tool of weatherTools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }

    // Get temperature for a city
    console.log('\nGetting temperature for New York...');
    const getTempTool = weatherTools.find(tool => tool.name === 'get_temperature');
    if (!getTempTool) {
      throw new Error('get_temperature tool not found');
    }
    const tempResult = await getTempTool.invoke({ city: 'New York' });
    console.log(tempResult);

    // Get forecast for a city
    console.log('\nGetting forecast for London...');
    const getForecastTool = weatherTools.find(tool => tool.name === 'get_forecast');
    if (!getForecastTool) {
      throw new Error('get_forecast tool not found');
    }
    const forecastResult = await getForecastTool.invoke({
      city: 'London',
      days: 3,
    });
    console.log(forecastResult);

    // Close the client
    console.log('\nClosing client...');
    await client.close();
    console.log('Client closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
