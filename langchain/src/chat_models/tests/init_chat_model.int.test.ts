// import { tool } from "@langchain/core/tools";
// import { initChatModel } from "../base.js";

// test("", async () => {
//   // Initialize non-configurable models:
//   const gpt4 = await initChatModel("gpt-4", {
//     modelProvider: "openai",
//     kwargs: { temperature: 0 },
//   });
//   const claude = await initChatModel("claude-3-opus-20240229", {
//     modelProvider: "anthropic",
//     kwargs: { temperature: 0 },
//   });
//   const gemini = await initChatModel("gemini-1.5-pro", {
//     modelProvider: "google_vertexai",
//     kwargs: { temperature: 0 },
//   });

//   gpt4.invoke("what's your name");
//   claude.invoke("what's your name");
//   gemini.invoke("what's your name");

//   // Create a partially configurable model with no default model:
//   const configurableModel = await initChatModel(undefined, {
//     kwargs: { temperature: 0 },
//   });

//   configurableModel.invoke("what's your name", {
//     config: { configurable: { model: "gpt-4" } },
//   });
//   // GPT-4 response

//   configurableModel.invoke("what's your name", {
//     config: { configurable: { model: "claude-3-5-sonnet-20240620" } },
//   });
//   // claude-3.5 sonnet response

//   // Create a fully configurable model with a default model and a config prefix:
//   const configurableModelWithDefault = await initChatModel("gpt-4", {
//     modelProvider: "openai",
//     configurableFields: "any",
//     configPrefix: "foo",
//     kwargs: { temperature: 0 },
//   });

//   configurableModelWithDefault.invoke("what's your name");
//   // GPT-4 response with temperature 0

//   configurableModelWithDefault.invoke("what's your name", {
//     config: {
//       configurable: {
//         foo_model: "claude-3-5-sonnet-20240620",
//         foo_modelProvider: "anthropic",
//         foo_temperature: 0.6,
//       },
//     },
//   });
//   // Claude-3.5 sonnet response with temperature 0.6

//   // Bind tools to a configurable model:
//   import { z } from "zod";
//   import { tool } from "@langchain/core/tools";

//   const GetWeather = z
//     .object({
//       location: z
//         .string()
//         .describe("The city and state, e.g. San Francisco, CA"),
//     })
//     .describe("Get the current weather in a given location");

//   const getWeatherTool = tool(
//     (input) => {
//       // Do something with the input
//     },
//     {
//       schema: GetWeather,
//       name: "GetWeather",
//       description: "Get the current weather in a given location",
//     }
//   );

//   const GetPopulation = z
//     .object({
//       location: z
//         .string()
//         .describe("The city and state, e.g. San Francisco, CA"),
//     })
//     .describe("Get the current population in a given location");

//   const getPopulationTool = tool(
//     (input) => {
//       // Do something with the input
//     },
//     {
//       schema: GetPopulation,
//       name: "GetPopulation",
//       description: "Get the current population in a given location",
//     }
//   );

//   const configurableModel = await initChatModel("gpt-4", {
//     configurableFields: ["model", "modelProvider"],
//     kwargs: { temperature: 0 },
//   });

//   const configurableModelWithTools = configurableModel.bind({
//     tools: [GetWeather, GetPopulation],
//   });

//   configurableModelWithTools.invoke(
//     "Which city is hotter today and which is bigger: LA or NY?"
//   );
//   // GPT-4 response with tool calls

//   configurableModelWithTools.invoke(
//     "Which city is hotter today and which is bigger: LA or NY?",
//     { config: { configurable: { model: "claude-3-5-sonnet-20240620" } } }
//   );
//   // Claude-3.5 sonnet response with tools
// });
