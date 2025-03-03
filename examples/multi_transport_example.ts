import { MultiServerMCPClient } from '../src/client.js';

/**
 * This example demonstrates how to use the MCP adapter with multiple servers
 * using different transport methods.
 *
 * It shows:
 * 1. How to connect to servers using different transport methods (stdio and SSE)
 * 2. Two different approaches to configure multiple servers:
 *    - Using a configuration object at initialization
 *    - Using individual connect methods after initialization
 * 3. How to use tools from different servers
 * 4. How to perform complex operations using tools from multiple servers
 *
 * Before running this example:
 * 1. Start the weather server with SSE transport:
 *    python examples/weather_server.py
 *
 * 2. Then run this example with:
 *    node --loader ts-node/esm examples/multi_transport_example.ts
 */
async function main() {
  console.log('=== Method 1: Using Configuration Object ===');
  await runWithConfigObject();

  console.log('\n\n=== Method 2: Using Individual Connect Methods ===');
  await runWithConnectMethods();
}

/**
 * Demonstrates using a configuration object to connect to multiple servers
 */
async function runWithConfigObject() {
  // Create a client with multiple server connections using a configuration object
  const client = new MultiServerMCPClient({
    math: {
      transport: 'stdio',
      command: 'python',
      args: ['./examples/math_server.py'],
    },
    weather: {
      transport: 'sse',
      url: 'http://localhost:8000/sse',
    },
  });

  try {
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

    await demonstrateTools(client);
  } finally {
    // Close the client
    console.log('\nClosing client...');
    await client.close();
    console.log('Client closed');
  }
}

/**
 * Demonstrates using individual connect methods to connect to multiple servers
 */
async function runWithConnectMethods() {
  // Create a client with math server configuration
  const mathClient = new MultiServerMCPClient({
    math: {
      transport: 'stdio',
      command: 'python',
      args: ['./examples/math_server.py'],
    },
  });

  // Create a client with weather server configuration
  const weatherClient = new MultiServerMCPClient({
    weather: {
      transport: 'sse',
      url: 'http://localhost:8000/sse',
    },
  });

  // Create a combined client for demonstration
  const combinedClient = new MultiServerMCPClient({
    math: {
      transport: 'stdio',
      command: 'python',
      args: ['./examples/math_server.py'],
    },
    weather: {
      transport: 'sse',
      url: 'http://localhost:8000/sse',
    },
  });

  try {
    // Initialize math server connection
    console.log('Connecting to math server...');
    try {
      await mathClient.initializeConnections();
      console.log('Connected to math server');
    } catch (error) {
      console.error(
        'Error connecting to math server:',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Initialize weather server connection
    console.log('\nConnecting to weather server...');
    try {
      await weatherClient.initializeConnections();
      console.log('Connected to weather server');
    } catch (error) {
      console.error(
        'Error connecting to weather server:',
        error instanceof Error ? error.message : String(error)
      );
    }

    // For demonstration purposes, we'll use the combined client
    // In a real application, you might want to merge the tools from both clients
    console.log('\nInitializing combined client for demonstration...');
    await combinedClient.initializeConnections();

    await demonstrateTools(combinedClient);
  } finally {
    // Close all clients
    console.log('\nClosing clients...');
    await mathClient.close();
    await weatherClient.close();
    await combinedClient.close();
    console.log('Clients closed');
  }
}

/**
 * Demonstrates using tools from multiple servers
 */
async function demonstrateTools(client: MultiServerMCPClient) {
  // Get all tools from all servers
  const serverTools = client.getTools();

  if (serverTools.size === 0) {
    console.log('No tools available. Make sure at least one server is running.');
    return;
  }

  // Flatten all tools for display purposes
  const allTools = Array.from(serverTools.values()).flat();
  console.log(`\nAvailable tools: ${allTools.map(tool => tool.name).join(', ')}`);

  console.log(`Tool descriptions:`);
  for (const [serverName, tools] of serverTools.entries()) {
    console.log(`\nServer: ${serverName}`);
    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }
  }

  // Use the math tools if available
  console.log('\n--- Math Operations ---');
  const mathTools = serverTools.get('math') || [];
  const addTool = mathTools.find(tool => tool.name === 'add');
  if (addTool) {
    const addResult = await addTool.invoke({ a: 5, b: 3 });
    console.log(`5 + 3 = ${addResult}`);
  } else {
    console.log('Add tool not available');
  }

  const multiplyTool = mathTools.find(tool => tool.name === 'multiply');
  if (multiplyTool) {
    const multiplyResult = await multiplyTool.invoke({ a: 4, b: 7 });
    console.log(`4 * 7 = ${multiplyResult}`);
  } else {
    console.log('Multiply tool not available');
  }

  // Use the weather tools if available
  console.log('\n--- Weather Information ---');
  const weatherTools = serverTools.get('weather') || [];
  const temperatureTool = weatherTools.find(tool => tool.name === 'get_temperature');
  if (temperatureTool) {
    const temperatureResult = await temperatureTool.invoke({
      city: 'New York',
    });
    console.log(`Temperature in New York: ${temperatureResult}`);
  } else {
    console.log('Temperature tool not available');
  }

  const forecastTool = weatherTools.find(tool => tool.name === 'get_forecast');
  if (forecastTool) {
    const forecastResult = await forecastTool.invoke({
      city: 'London',
      days: 3,
    });
    console.log(`Forecast for London: ${forecastResult}`);
  } else {
    console.log('Forecast tool not available');
  }

  // Perform complex operations if all required tools are available
  if (addTool && multiplyTool && temperatureTool) {
    console.log('\n--- Complex Operations ---');

    // Example 1: Simple math operation
    const sum = await addTool.invoke({ a: 5, b: 3 });
    const product = await multiplyTool.invoke({ a: sum, b: 2 });
    console.log(`(5 + 3) * 2 = ${product}`);

    // Example 2: Convert temperature from Fahrenheit to Celsius
    const temperatureResult = await temperatureTool.invoke({
      city: 'New York',
    });
    const tempStr = temperatureResult.toString();
    const tempMatch = tempStr.match(/(\d+)°F/);

    if (tempMatch && tempMatch[1]) {
      const tempF = parseInt(tempMatch[1]);
      const tempMinusThirtyTwo = await addTool.invoke({ a: tempF, b: -32 });
      const tempCelsius = await multiplyTool.invoke({
        a: tempMinusThirtyTwo,
        b: 5 / 9,
      });
      console.log(`Temperature in New York converted to Celsius: ${Math.round(tempCelsius)}°C`);
    } else {
      console.log('Could not extract temperature value for conversion');
    }
  }
}

main().catch(error =>
  console.error('Unhandled error:', error instanceof Error ? error.message : String(error))
);
