import { MultiServerMCPClient } from '../src/client.js';

/**
 * This example demonstrates how to use the MCP adapter with a custom configuration
 * that specifies different transport types for different servers.
 *
 * It shows:
 * 1. How to create a client with a custom configuration
 * 2. How to use the default stdio transport implicitly
 * 3. How to specify the SSE transport explicitly
 * 4. How to handle connection errors gracefully
 * 5. How to use tools from different servers
 *
 * Before running this example:
 * 1. Start the weather server with SSE transport:
 *    python examples/weather_server.py
 *
 * 2. Then run this example with:
 *    node --loader ts-node/esm examples/transport_config_example.ts
 */
async function main() {
  console.log('Creating MCP client with custom transport configuration...');

  try {
    // Create a client with a custom configuration
    const client = new MultiServerMCPClient({
      math: {
        // No transport specified - will default to stdio
        command: 'python',
        args: ['./examples/math_server.py'],
      },
      weather: {
        // Explicitly specify SSE transport
        transport: 'sse',
        url: 'http://localhost:8000/sse',
      },
    });

    // Initialize all connections
    console.log('Initializing connections to all servers...');

    try {
      await client.initializeConnections();
      console.log('Connected to all servers');
    } catch (error) {
      console.error(
        'Error connecting to some servers:',
        error instanceof Error ? error.message : String(error)
      );
      console.log('Continuing with available servers...');
    }

    // Get all tools from all servers
    const serverTools = client.getTools();

    if (serverTools.size === 0) {
      console.log('No tools available. Make sure at least one server is running.');
      return;
    }

    // Flatten all tools for display purposes
    const allTools = Array.from(serverTools.values()).flat();
    console.log(`Available tools: ${allTools.map(tool => tool.name).join(', ')}`);

    console.log(`Tool descriptions:`);
    for (const [serverName, tools] of serverTools.entries()) {
      console.log(`\nServer: ${serverName}`);
      for (const tool of tools) {
        console.log(`- ${tool.name}: ${tool.description}`);
      }
    }

    // Use the add tool from math server if available
    const mathTools = serverTools.get('math') || [];
    const addTool = mathTools.find(tool => tool.name === 'add');
    if (addTool) {
      console.log('\nUsing add tool from math server...');
      const addResult = await addTool.invoke({ a: 10, b: 5 });
      console.log(`10 + 5 = ${addResult}`);
    } else {
      console.log('\nAdd tool not available. Make sure the math server is running.');
    }

    // Use the multiply tool from math server if available
    const multiplyTool = mathTools.find(tool => tool.name === 'multiply');
    if (multiplyTool) {
      console.log('\nUsing multiply tool from math server...');
      const multiplyResult = await multiplyTool.invoke({ a: 7, b: 8 });
      console.log(`7 * 8 = ${multiplyResult}`);
    } else {
      console.log('\nMultiply tool not available. Make sure the math server is running.');
    }

    // Get temperature from weather server if available
    const weatherTools = serverTools.get('weather') || [];
    const getTempTool = weatherTools.find(tool => tool.name === 'get_temperature');
    if (getTempTool) {
      console.log('\nGetting temperature from weather server...');
      const tempResult = await getTempTool.invoke({ city: 'Tokyo' });
      console.log(tempResult);
    } else {
      console.log('\nTemperature tool not available. Make sure the weather server is running.');
    }

    // Get forecast from weather server if available
    const getForecastTool = weatherTools.find(tool => tool.name === 'get_forecast');
    if (getForecastTool) {
      console.log('\nGetting forecast from weather server...');
      const forecastResult = await getForecastTool.invoke({
        city: 'London',
        days: 3,
      });
      console.log(forecastResult);
    } else {
      console.log('\nForecast tool not available. Make sure the weather server is running.');
    }

    // Close the client when done
    console.log('\nClosing client...');
    await client.close();
    console.log('Client closed');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

main().catch(error =>
  console.error('Unhandled error:', error instanceof Error ? error.message : String(error))
);
