import { jest, test } from "@jest/globals";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { OutputParserException } from "@langchain/core/output_parsers";
import { ChatAnthropic } from "../chat_models.js";

test("withStructuredOutput with output validation", async () => {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307",
    temperature: 0,
    anthropicApiKey: "testing",
  });
  jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .spyOn(model as any, "invoke")
    .mockResolvedValue(
      new AIMessage({
        content: [
          {
            type: "tool_use",
            id: "notreal",
            name: "Extractor",
            input: "Incorrect string tool call input",
          },
        ],
      })
    );
  const schema = z.object({
    alerts: z
      .array(
        z.object({
          description: z.string().describe("A description of the alert."),
          severity: z
            .enum(["HIGH", "MEDIUM", "LOW"])
            .describe("How severe the alert is."),
        })
      )
      .describe(
        "Important security or infrastructure alerts present in the given text."
      ),
  });

  const modelWithStructuredOutput = model.withStructuredOutput(schema, {
    name: "Extractor",
  });

  await expect(async () => {
    await modelWithStructuredOutput.invoke(`
      Enumeration of Kernel Modules via Proc
      Prompt for Credentials with OSASCRIPT
      User Login
      Modification of Standard Authentication Module
      Suspicious Automator Workflows Execution
    `);
  }).rejects.toThrowError(OutputParserException);
});

test("withStructuredOutput with proper output", async () => {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307",
    temperature: 0,
    anthropicApiKey: "testing",
  });
  jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .spyOn(model as any, "invoke")
    .mockResolvedValue(
      new AIMessage({
        content: [
          {
            type: "tool_use",
            id: "notreal",
            name: "Extractor",
            input: { alerts: [{ description: "test", severity: "LOW" }] },
          },
        ],
      })
    );
  const schema = z.object({
    alerts: z
      .array(
        z.object({
          description: z.string().describe("A description of the alert."),
          severity: z
            .enum(["HIGH", "MEDIUM", "LOW"])
            .describe("How severe the alert is."),
        })
      )
      .describe(
        "Important security or infrastructure alerts present in the given text."
      ),
  });

  const modelWithStructuredOutput = model.withStructuredOutput(schema, {
    name: "Extractor",
  });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await modelWithStructuredOutput.invoke(`
    Enumeration of Kernel Modules via Proc
    Prompt for Credentials with OSASCRIPT
    User Login
    Modification of Standard Authentication Module
    Suspicious Automator Workflows Execution
  `);

  // console.log(result);
});
