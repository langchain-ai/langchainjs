import { z } from "zod/v3";
import { tool } from "../../tools/index.js";
import { FakeChatModel } from "../../utils/testing/index.js";

describe("ChatModelBinding", () => {
  test("can use withStructuredOutput and bindTools together", () => {
    const model = new FakeChatModel({});
    const binding = model
      .withStructuredOutput(
        z.object({
          foo: z.string(),
        })
      )
      .bindTools([
        {
          name: "foo",
          description: "foo",
          schema: z.object({
            bar: z.string(),
          }),
        },
      ]);
    expect(binding).toBeDefined();
  });
  test("???", () => {
    const testTool = tool(() => "foo", {
      name: "foo",
      description: "foo",
      schema: z.object({
        bar: z.string(),
      }),
    });
    const schema = z.object({
      foo: z.string(),
    });
    const model = new FakeChatModel({});
    const binding = model
      .bindTools([testTool])
      .withStructuredOutput(schema)
      .bindTools([testTool])
      .bindTools([testTool])
      .withStructuredOutput(schema);
    expect(binding).toBeDefined();
  });
});
