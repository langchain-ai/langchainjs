/**
 * Access External Context in Tools
 *
 * This enables tools to access external application state, user data, and environmental context when executing their functions, making tool behavior context-aware and personalized.
 *
 * Why this is important:
 * - Contextual Tool Execution:
 *   Tools can adapt their behavior based on user identity, preferences, or current application state
 * - Data Integration:
 *   Seamlessly incorporates external data sources and APIs into tool functionality
 * - Security and Personalization:
 *   Ensures tools operate with appropriate permissions and user-specific context
 *
 * Example Scenario:
 * You're building a travel planning assistant. When the weather tool is called, it not only gets weather data but
 * also considers the user's preferences (e.g., they hate rain, prefer temperatures above 70°F) and their accessibility
 * needs (e.g., wheelchair-friendly venues) to provide more relevant recommendations.
 */

import {
  createReactAgent,
  tool,
  setContextVariable,
  getContextVariable,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Simulate external weather service
 */
async function getWeatherForUser(
  location: string,
  userId: string,
  preferences: any
) {
  const baseWeather = `Weather in ${location}: 75°F, partly cloudy`;

  // Customize based on user preferences
  if (preferences?.units === "celsius") {
    return `Weather in ${location}: 24°C, partly cloudy (customized for user ${userId})`;
  }

  if (preferences?.includeWind) {
    return `${baseWeather}, winds 10mph (detailed forecast for user ${userId})`;
  }

  return `${baseWeather} (for user ${userId})`;
}

/**
 * Tool that accesses external context
 */
const weatherTool = tool(
  async (input: { location: string }) => {
    // Access external context for personalized responses
    const userId = getContextVariable("userId");
    const userPreferences = getContextVariable("userPreferences");

    console.log(`Weather tool called for user: ${userId}`);
    console.log(`User preferences:`, userPreferences);

    // Use context to customize tool behavior
    const weatherData = await getWeatherForUser(
      input.location,
      userId,
      userPreferences
    );
    return weatherData;
  },
  {
    name: "get_weather",
    description: "Get weather for a location with user personalization",
    schema: z.object({
      location: z.string().describe("The location to get weather for"),
    }),
  }
);

/**
 * Create agent that uses tools with external context
 */
const agent = createReactAgent({
  llm: new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  }),
  tools: [weatherTool],
  prompt:
    "You are a helpful travel assistant. Use the weather tool to help users plan their trips.",
});

/**
 * Function to handle requests with external context
 */
async function handleUserRequest(
  userId: string,
  userPreferences: any,
  query: string
) {
  // Set external context before invoking agent
  setContextVariable("userId", userId);
  setContextVariable("userPreferences", userPreferences);

  console.log(`\n--- Handling request for user: ${userId} ---`);
  console.log(`Query: ${query}`);

  const result = await agent.invoke({
    messages: [{ role: "user", content: query }],
  });

  console.log(result.messages[result.messages.length - 1].content);
}

/**
 * Example usage demonstrating User 1: Prefers Celsius and detailed forecasts
 */
await handleUserRequest(
  "user_123",
  { units: "celsius", includeWind: true },
  "What's the weather like in Paris?"
);

/**
 * Example usage demonstrating User 2: Standard preferences
 */
await handleUserRequest(
  "user_456",
  { units: "fahrenheit" },
  "I'm planning a trip to Tokyo, what should I expect weather-wise?"
);

/**
 * Example usage demonstrating User 3: No special preferences
 */
await handleUserRequest(
  "user_789",
  {},
  "Check the weather in New York for my business trip"
);

/**
 * Returns:
 *
 * --- Handling request for user: user_123 ---
 * Query: What's the weather like in Paris?
 * Weather tool called for user: user_123
 * User preferences: { units: 'celsius', includeWind: true }
 * The weather in Paris is currently 24°C and partly cloudy.
 *
 * --- Handling request for user: user_456 ---
 * Query: I'm planning a trip to Tokyo, what should I expect weather-wise?
 * Weather tool called for user: user_456
 * User preferences: { units: 'fahrenheit' }
 * In Tokyo, you can expect partly cloudy weather with a temperature of around 75°F. Enjoy your trip!
 *
 * --- Handling request for user: user_789 ---
 * Query: Check the weather in New York for my business trip
 * Weather tool called for user: user_789
 * User preferences: {}
 * The weather in New York is currently 75°F and partly cloudy. Enjoy your business trip!
 */
