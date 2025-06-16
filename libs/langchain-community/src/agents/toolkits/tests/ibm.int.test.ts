/* eslint-disable no-process-env */
import {
  convertUtilityToolToWatsonxTool,
  WatsonXAI,
} from "@ibm-cloud/watsonx-ai";
import { WatsonxTool, WatsonxToolkit } from "../ibm.js";

const serviceUrl = process.env.WATSONX_AI_SERVICE_URL as string;
describe("Tool class tests", () => {
  describe("Positive tests", () => {
    test("Invoke tool with json", async () => {
      const service = WatsonXAI.newInstance({
        serviceUrl,
        version: "2024-05-31",
      });
      const tool = new WatsonxTool(
        {
          name: "Weather",
          description: "Get the weather for a given location",
          parameters: {
            type: "object",
            properties: {
              location: {
                title: "location",
                description: "Name of the location",
                type: "string",
              },
              country: {
                title: "country",
                description: "Name of the state or country",
                type: "string",
              },
            },
            required: ["location"],
          },
        },
        service
      );

      const res = await tool.invoke({ location: "Krakow" });
      expect(res).toBeDefined();
    });
    test("Invoke tool with tool_call", async () => {
      const service = WatsonXAI.newInstance({
        serviceUrl,
        version: "2024-05-31",
      });
      const tool = new WatsonxTool(
        {
          name: "Weather",
          description: "Get the weather for a given location",
          parameters: {
            type: "object",
            properties: {
              location: {
                title: "location",
                description: "Name of the location",
                type: "string",
              },
              country: {
                title: "country",
                description: "Name of the state or country",
                type: "string",
              },
            },
            required: ["location"],
          },
        },
        service
      );
      const toolCall = {
        name: "Weather",
        args: {
          location: "Krakow",
        },
        type: "tool_call",
        id: "ABCD12345",
      };
      const res = await tool.invoke(toolCall);
      expect(res).toBeDefined();
    });
    test("Invoke tool with config", async () => {
      const service = WatsonXAI.newInstance({
        serviceUrl,
        version: "2024-05-31",
      });
      const configSchema = {
        title: "config schema for GoogleSearch tool",
        type: "object",
        properties: {
          maxResults: {
            title: "Max number of results to return",
            type: "integer",
            minimum: 1,
            maximum: 20,
            wx_ui_name: "Max results",
            wx_ui_field_type: "numberInput",
            wx_ui_default: 10,
          },
        },
      };

      const { function: watsonxTool } = convertUtilityToolToWatsonxTool({
        name: "GoogleSearch",
        description:
          "Search for online trends, news, current events, real-time information, or research topics.",
        agent_description:
          "Search for online trends, news, current events, real-time information, or research topics.",
        config_schema: configSchema,
      });
      if (!watsonxTool) throw new Error("Could parse a tool");

      const tool = new WatsonxTool(watsonxTool, service, configSchema);
      tool.config = { maxResults: 2 };

      const res = await tool.invoke({ input: "Who won 2022 World Cup?" });
      expect(JSON.parse(res).length).toBeLessThanOrEqual(2);
    });
  });
});

describe("Toolkit class tests", () => {
  describe("Positive tests", () => {
    test("Toolkit init", async () => {
      const toolkit = await WatsonxToolkit.init({
        version: "2024-05-31",
        serviceUrl,
      });
      expect(toolkit).toBeInstanceOf(WatsonxToolkit);
    });
    test("Test method getTools", async () => {
      const toolkit = await WatsonxToolkit.init({
        version: "2024-05-31",
        serviceUrl,
      });
      const testTools = toolkit.getTools();
      testTools.map((tool) => expect(tool).toBeInstanceOf(WatsonxTool));
    });
    test("Test method getTool", async () => {
      const toolkit = await WatsonxToolkit.init({
        version: "2024-05-31",
        serviceUrl,
      });
      const tool = toolkit.getTool("Weather");
      expect(tool).toBeInstanceOf(WatsonxTool);
    });
    test("Tool call with config", async () => {
      const toolkit = await WatsonxToolkit.init({
        version: "2024-05-31",
        serviceUrl,
      });
      const tool = toolkit.getTool("GoogleSearch", {
        maxResults: 2,
      });
      const res = await tool?.invoke({
        input: "Who won F1 in Melbourne 2025?",
      });
      const array = JSON.parse(res);
      expect(array.length).toBeLessThanOrEqual(2);
    });
    test("Tool call with tool.config override getTool config", async () => {
      const toolkit = await WatsonxToolkit.init({
        version: "2024-05-31",
        serviceUrl,
      });
      const tool = toolkit.getTool("GoogleSearch", {
        maxResults: 4,
      });
      tool.config = {
        maxResults: 2,
      };
      const res = await tool?.invoke({
        input: "Who won F1 in Melbourne 2025?",
      });
      const array = JSON.parse(res);
      expect(array.length).toBeLessThanOrEqual(2);
    });
  });
  describe("Negative tests", () => {
    test("getTools with not existing tool", async () => {
      const toolkit = await WatsonxToolkit.init({
        version: "2024-05-31",
        serviceUrl,
      });
      try {
        toolkit.getTool("iDoNotExist");
      } catch (e: any) {
        expect(e.message).toBe("Tool with provided name does not exist");
      }
    });
  });
});
