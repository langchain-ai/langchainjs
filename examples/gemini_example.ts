import { MultiServerMCPClient } from '../src/client.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * This example demonstrates how to use MCP tools with Google's Gemini model.
 *
 * It connects to both a math server and a weather server, retrieves the available tools,
 * and uses them directly with the model.
 *
 * Note: You need to set the GOOGLE_API_KEY environment variable in the .env file to run this example.
 */
async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error('Please set the GOOGLE_API_KEY environment variable in the .env file');
    process.exit(1);
  }

  // Create a client with configurations for both servers
  const client = new MultiServerMCPClient({
    math: {
      transport: 'stdio',
      command: 'python',
      args: ['./examples/math_server.py'],
    },
    weather: {
      transport: 'stdio',
      command: 'python',
      args: ['./examples/weather_server.py'],
    },
  });

  try {
    // Initialize connections to both servers
    console.log('Initializing connections to servers...');
    await client.initializeConnections();
    console.log('Connected to servers');

    // Get all tools from all servers
    const serverTools = client.getTools();

    // Flatten all tools for display purposes
    const allTools = Array.from(serverTools.values()).flat();
    console.log(`Available tools: ${allTools.map(tool => tool.name).join(', ')}`);

    // Print tool descriptions
    console.log('Tool descriptions:');
    for (const [serverName, tools] of serverTools.entries()) {
      console.log(`\nServer: ${serverName}`);
      for (const tool of tools) {
        console.log(`- ${tool.name}: ${tool.description}`);
      }
    }

    // Create the model
    console.log('\nCreating model...');
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: 'gemini-2.0-flash',
      temperature: 0,
    });

    // Define some example operations
    console.log('\n--- Math Operations ---');

    // Get math tools
    const mathTools = serverTools.get('math') || [];

    // Add two numbers
    const addTool = mathTools.find(t => t.name === 'add');
    if (addTool) {
      const addResult = await addTool.invoke({
        a: 5,
        b: 3,
      });
      console.log(`5 + 3 = ${addResult}`);
    } else {
      console.log('Add tool not available');
    }

    // Multiply two numbers
    const multiplyTool = mathTools.find(t => t.name === 'multiply');
    if (multiplyTool) {
      const multiplyResult = await multiplyTool.invoke({
        a: 4,
        b: 7,
      });
      console.log(`4 * 7 = ${multiplyResult}`);
    } else {
      console.log('Multiply tool not available');
    }

    // Get weather information
    console.log('\n--- Weather Information ---');

    // Get weather tools
    const weatherTools = serverTools.get('weather') || [];

    // Get temperature for a city
    const temperatureTool = weatherTools.find(t => t.name === 'get_temperature');
    let temperatureResult;
    if (temperatureTool) {
      temperatureResult = await temperatureTool.invoke({
        city: 'New York',
      });
      console.log(`Temperature in New York: ${temperatureResult}`);
    } else {
      console.log('Temperature tool not available');
    }

    // Get forecast for a city
    const forecastTool = weatherTools.find(t => t.name === 'get_forecast');
    let forecastResult;
    if (forecastTool) {
      forecastResult = await forecastTool.invoke({
        city: 'London',
        days: 3,
      });
      console.log(`Forecast for London: ${forecastResult}`);
    } else {
      console.log('Forecast tool not available');
    }

    // Use Gemini to interpret the results
    console.log('\n--- Gemini Interpretations ---');

    // Ask Gemini to convert Fahrenheit to Celsius
    if (temperatureResult) {
      const tempConversionPrompt = `If the temperature in New York is ${temperatureResult}, what is that in Celsius?`;
      console.log(`Query: "${tempConversionPrompt}"`);
      const tempConversionResponse = await model.invoke(tempConversionPrompt);
      console.log(`Gemini's answer: ${tempConversionResponse.content}`);
    }

    // Ask Gemini to summarize the forecast
    if (forecastResult) {
      const forecastSummaryPrompt = `Summarize this forecast: ${forecastResult}`;
      console.log(`\nQuery: "${forecastSummaryPrompt}"`);
      const forecastSummaryResponse = await model.invoke(forecastSummaryPrompt);
      console.log(`Gemini's answer: ${forecastSummaryResponse.content}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the client
    console.log('\nClosing client...');
    await client.close();
    console.log('Client closed');
  }
}

main().catch(console.error);
