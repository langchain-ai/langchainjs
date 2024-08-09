import { test, expect } from "@jest/globals";
import { z } from "zod";
import { JsonOutputKeyToolsParser } from "../json_output_tools_parsers.js";
import { AIMessage } from "../../../messages/index.js";
import { OutputParserException } from "../../base.js";

test("JSONOutputKeyToolsParser invoke", async () => {
  const outputParser = new JsonOutputKeyToolsParser({
    keyName: "testing",
    returnSingle: true,
  });
  const result = await outputParser.invoke(
    new AIMessage({
      content: "",
      additional_kwargs: {
        tool_calls: [
          {
            id: "test",
            type: "function",
            function: {
              name: "testing",
              arguments: JSON.stringify({ testKey: 9 }),
            },
          },
        ],
      },
    })
  );
  expect(result).toEqual({ testKey: 9 });
});

test("JSONOutputKeyToolsParser with a passed schema throws", async () => {
  const outputParser = new JsonOutputKeyToolsParser({
    keyName: "testing",
    returnSingle: true,
    zodSchema: z.object({
      testKey: z.string(),
    }),
  });
  try {
    await outputParser.invoke(
      new AIMessage({
        content: "",
        additional_kwargs: {
          tool_calls: [
            {
              id: "test",
              type: "function",
              function: {
                name: "testing",
                arguments: JSON.stringify({ testKey: 9 }),
              },
            },
          ],
        },
      })
    );
  } catch (e) {
    expect(e).toBeInstanceOf(OutputParserException);
  }
});

test("JSONOutputKeyToolsParser can validate a proper input", async () => {
  const outputParser = new JsonOutputKeyToolsParser({
    keyName: "testing",
    returnSingle: true,
    zodSchema: z.object({
      testKey: z.string(),
    }),
  });
  const result = await outputParser.invoke(
    new AIMessage({
      content: "",
      additional_kwargs: {
        tool_calls: [
          {
            id: "test",
            type: "function",
            function: {
              name: "testing",
              arguments: JSON.stringify({ testKey: "testval" }),
            },
          },
        ],
      },
    })
  );
  expect(result).toEqual({ testKey: "testval" });
});
