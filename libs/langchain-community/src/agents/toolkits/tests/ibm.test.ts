/* eslint-disable no-process-env */
/* eslint-disable no-new */
import {
  WatsonXAI,
  convertUtilityToolToWatsonxTool,
} from "@ibm-cloud/watsonx-ai";
import { WatsonxTool } from "../ibm.js";

const service = {} as WatsonXAI;

describe("Tool class tests", () => {
  describe("Positive tests", () => {
    test("Init tool", async () => {
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
            required: ["name"],
          },
        },
        service
      );
      expect(tool).toBeInstanceOf(WatsonxTool);
    });
    test("Pass config to tool", async () => {
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
      let { function: watsonxTool } = convertUtilityToolToWatsonxTool({
        name: "GoogleSearch",
        description:
          "Search for online trends, news, current events, real-time information, or research topics.",
        agent_description:
          "Search for online trends, news, current events, real-time information, or research topics.",
        config_schema: configSchema,
      });
      expect(watsonxTool).toBeDefined();
      watsonxTool = watsonxTool as WatsonXAI.TextChatParameterFunction;
      const tool = new WatsonxTool(watsonxTool, service, configSchema);
      tool.config = { maxResults: 5, invalidResult: 10 };
      expect(tool.toolConfig).toBeDefined();
      expect(tool.toolConfig?.maxResults).toBe(5);
      expect(tool.toolConfig?.invalidResult).toBeUndefined();
    });
  });
  describe("Negative tests", () => {
    test("Init tool with invalid schema", async () => {
      try {
        new WatsonxTool(
          {
            name: "Weather",
          },
          service
        );
      } catch (e: any) {
        expect(e.message).toBe("Unsupported root schema type");
      }
    });
  });
});
