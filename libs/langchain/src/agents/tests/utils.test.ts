import { describe, it, expect } from "vitest";
import z from "zod/v3";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatXAI } from "@langchain/xai";
import {
  Runnable,
  RunnableLambda,
  RunnableSequence,
} from "@langchain/core/runnables";

import {
  _addInlineAgentName,
  _removeInlineAgentName,
  shouldBindTools,
  bindTools,
  hasSupportForJsonSchemaOutput,
} from "../utils.js";
import {
  FakeToolCallingChatModel,
  FakeConfigurableModel,
  FakeToolCallingModel,
} from "./utils.js";

describe("_addInlineAgentName", () => {
  it("should return non-AI messages unchanged", () => {
    const humanMessage = new HumanMessage("Hello");
    const result = _addInlineAgentName(humanMessage);
    expect(result).toEqual(humanMessage);
  });

  it("should return AI messages with no name unchanged", () => {
    const aiMessage = new AIMessage("Hello world");
    const result = _addInlineAgentName(aiMessage);
    expect(result).toEqual(aiMessage);
  });

  it("should format AI messages with name and content tags", () => {
    const aiMessage = new AIMessage({
      content: "Hello world",
      name: "assistant",
    });
    const result = _addInlineAgentName(aiMessage);
    expect(result.content).toEqual(
      "<name>assistant</name><content>Hello world</content>"
    );
  });

  it("should handle content blocks correctly", () => {
    const contentBlocks = [
      { type: "text", text: "Hello world" },
      { type: "image", image_url: "http://example.com/image.jpg" },
    ];
    const aiMessage = new AIMessage({
      content: contentBlocks,
      name: "assistant",
    });
    const result = _addInlineAgentName(aiMessage);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "<name>assistant</name><content>Hello world</content>",
      },
      { type: "image", image_url: "http://example.com/image.jpg" },
    ]);
  });

  it("should handle content blocks without text blocks", () => {
    const contentBlocks = [
      { type: "image", image_url: "http://example.com/image.jpg" },
      { type: "file", file_url: "http://example.com/document.pdf" },
    ];
    const expectedContentBlocks = [
      { type: "text", text: "<name>assistant</name><content></content>" },
      ...contentBlocks,
    ];
    const aiMessage = new AIMessage({
      content: contentBlocks,
      name: "assistant",
    });
    const result = _addInlineAgentName(aiMessage);
    expect(result.content).toEqual(expectedContentBlocks);
  });
});

describe("_removeInlineAgentName", () => {
  it("should return non-AI messages unchanged", () => {
    const humanMessage = new HumanMessage("Hello");
    const result = _removeInlineAgentName(humanMessage);
    expect(result).toEqual(humanMessage);
  });

  it("should return messages with empty content unchanged", () => {
    const aiMessage = new AIMessage({
      content: "",
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);
    expect(result).toEqual(aiMessage);
  });

  it("should return messages without name/content tags unchanged", () => {
    const aiMessage = new AIMessage({
      content: "Hello world",
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);
    expect(result).toEqual(aiMessage);
  });

  it("should correctly extract content from tags", () => {
    const aiMessage = new AIMessage({
      content: "<name>assistant</name><content>Hello world</content>",
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);
    expect(result.content).toEqual("Hello world");
    expect(result.name).toEqual("assistant");
  });

  it("should handle content blocks correctly", () => {
    const contentBlocks = [
      {
        type: "text",
        text: "<name>assistant</name><content>Hello world</content>",
      },
      { type: "image", image_url: "http://example.com/image.jpg" },
    ];
    const aiMessage = new AIMessage({
      content: contentBlocks,
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);

    const expectedContent = [
      { type: "text", text: "Hello world" },
      { type: "image", image_url: "http://example.com/image.jpg" },
    ];
    expect(result.content).toEqual(expectedContent);
    expect(result.name).toEqual("assistant");
  });

  it("should handle content blocks with empty text content", () => {
    const contentBlocks = [
      { type: "text", text: "<name>assistant</name><content></content>" },
      { type: "image", image_url: "http://example.com/image.jpg" },
      { type: "file", file_url: "http://example.com/document.pdf" },
    ];
    const expectedContentBlocks = contentBlocks.slice(1);
    const aiMessage = new AIMessage({
      content: contentBlocks,
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);
    expect(result.content).toEqual(expectedContentBlocks);
  });

  it("should handle multiline content", () => {
    const multilineContent = `<name>assistant</name><content>This is
a multiline
message</content>`;
    const aiMessage = new AIMessage({
      content: multilineContent,
      name: "assistant",
    });
    const result = _removeInlineAgentName(aiMessage);
    expect(result.content).toEqual("This is\na multiline\nmessage");
  });
});

describe("shouldBindTools", () => {
  it.each(["openai", "anthropic", "google", "bedrock"] as const)(
    "Should determine when to bind tools - %s style",
    async (toolStyle) => {
      const tool1 = tool((input) => `Tool 1: ${input.someVal}`, {
        name: "tool1",
        description: "Tool 1 docstring.",
        schema: z.object({
          someVal: z.number().describe("Input value"),
        }),
      });

      const tool2 = tool((input) => `Tool 2: ${input.someVal}`, {
        name: "tool2",
        description: "Tool 2 docstring.",
        schema: z.object({
          someVal: z.number().describe("Input value"),
        }),
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("test")],
        toolStyle,
      });

      // Should bind when a regular model
      expect(await shouldBindTools(model, [])).toBe(true);
      expect(await shouldBindTools(model, [tool1])).toBe(true);

      // Should bind when a seq
      const seq = RunnableSequence.from([
        model,
        RunnableLambda.from((message) => message),
      ]);
      expect(await shouldBindTools(seq, [])).toBe(true);
      expect(await shouldBindTools(seq, [tool1])).toBe(true);

      // Should not bind when a model with tools
      const modelWithTools = model.bindTools([tool1]);
      expect(await shouldBindTools(modelWithTools, [tool1])).toBe(false);

      // Should not bind when a seq with tools
      const seqWithTools = RunnableSequence.from([
        model.bindTools([tool1]),
        RunnableLambda.from((message) => message),
      ]);
      expect(await shouldBindTools(seqWithTools, [tool1])).toBe(false);

      // Should raise on invalid inputs
      await expect(
        async () => await shouldBindTools(model.bindTools([tool1]), [])
      ).rejects.toThrow();
      await expect(
        async () => await shouldBindTools(model.bindTools([tool1]), [tool2])
      ).rejects.toThrow();
      await expect(
        async () =>
          await shouldBindTools(model.bindTools([tool1]), [tool1, tool2])
      ).rejects.toThrow();

      // test configurable model
      const configurableModel = new FakeConfigurableModel({
        model,
      });

      // Should bind when a regular model
      expect(await shouldBindTools(configurableModel, [])).toBe(true);
      expect(await shouldBindTools(configurableModel, [tool1])).toBe(true);

      // Should bind when a seq
      const configurableSeq = RunnableSequence.from([
        configurableModel,
        RunnableLambda.from((message) => message),
      ]);
      expect(await shouldBindTools(configurableSeq, [])).toBe(true);
      expect(await shouldBindTools(configurableSeq, [tool1])).toBe(true);

      // Should not bind when a model with tools
      const configurableModelWithTools = configurableModel.bindTools([tool1]);
      expect(await shouldBindTools(configurableModelWithTools, [tool1])).toBe(
        false
      );

      // Should not bind when a seq with tools
      const configurableSeqWithTools = RunnableSequence.from([
        configurableModel.bindTools([tool1]),
        RunnableLambda.from((message) => message),
      ]);
      expect(await shouldBindTools(configurableSeqWithTools, [tool1])).toBe(
        false
      );

      // Should raise on invalid inputs
      await expect(
        async () =>
          await shouldBindTools(configurableModel.bindTools([tool1]), [])
      ).rejects.toThrow();
      await expect(
        async () =>
          await shouldBindTools(configurableModel.bindTools([tool1]), [tool2])
      ).rejects.toThrow();
      await expect(
        async () =>
          await shouldBindTools(configurableModel.bindTools([tool1]), [
            tool1,
            tool2,
          ])
      ).rejects.toThrow();
    }
  );

  it("should bind model with bindTools", async () => {
    const tool1 = tool((input) => `Tool 1: ${input.someVal}`, {
      name: "tool1",
      description: "Tool 1 docstring.",
      schema: z.object({
        someVal: z.number().describe("Input value"),
      }),
    });

    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("test")],
      toolStyle: "openai",
    });

    const confModel = new FakeConfigurableModel({ model });

    async function serialize(runnable: Runnable | Promise<Runnable>) {
      return JSON.parse(JSON.stringify(await runnable));
    }

    // Should bind when a regular model
    expect(
      await serialize((await bindTools(model, [tool1])) as Runnable)
    ).toEqual(await serialize(model.bindTools([tool1])));

    // Should bind when model wrapped in `withConfig`
    expect(
      await serialize(
        (await bindTools(model.withConfig({ tags: ["nostream"] }), [
          tool1,
        ])) as Runnable
      )
    ).toEqual(
      await serialize(
        model.bindTools([tool1]).withConfig({ tags: ["nostream"] })
      )
    );

    // Should bind when model wrapped in multiple `withConfig`
    expect(
      await serialize(
        (await bindTools(
          model
            .withConfig({ tags: ["nostream"] })
            .withConfig({ metadata: { hello: "world" } }),
          [tool1]
        )) as Runnable
      )
    ).toEqual(
      await serialize(
        model
          .bindTools([tool1])
          .withConfig({ tags: ["nostream"], metadata: { hello: "world" } })
      )
    );

    // Should bind when a configurable model
    expect(
      await serialize((await bindTools(confModel, [tool1])) as Runnable)
    ).toEqual(await serialize(confModel.bindTools([tool1])));

    // Should bind when a seq
    expect(
      await serialize(
        (await bindTools(
          RunnableSequence.from([
            model,
            RunnableLambda.from((message) => message),
          ]),
          [tool1]
        )) as Runnable
      )
    ).toEqual(
      await serialize(
        RunnableSequence.from([
          model.bindTools([tool1]),
          RunnableLambda.from((message) => message),
        ])
      )
    );

    // Should bind when a seq with configurable model
    expect(
      await serialize(
        (await bindTools(
          RunnableSequence.from([
            confModel,
            RunnableLambda.from((message) => message),
          ]),
          [tool1]
        )) as Runnable
      )
    ).toEqual(
      await serialize(
        RunnableSequence.from([
          confModel.bindTools([tool1]),
          RunnableLambda.from((message) => message),
        ])
      )
    );

    // Should bind when a seq with config model
    expect(
      await serialize(
        (await bindTools(
          RunnableSequence.from([
            confModel.withConfig({ tags: ["nostream"] }),
            RunnableLambda.from((message) => message),
          ]),
          [tool1]
        )) as Runnable
      )
    ).toEqual(
      await serialize(
        RunnableSequence.from([
          confModel.bindTools([tool1]).withConfig({
            tags: ["nostream"],
          }),
          RunnableLambda.from((message) => message),
        ])
      )
    );
  });

  it("should handle bindTool with server tools", async () => {
    const tool1 = tool((input) => `Tool 1: ${input.someVal}`, {
      name: "tool1",
      description: "Tool 1 docstring.",
      schema: z.object({ someVal: z.number().describe("Input value") }),
    });

    const server = { type: "web_search_preview" };

    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("test")],
    });

    expect(await shouldBindTools(model, [tool1, server])).toBe(true);
    expect(
      await shouldBindTools(model.bindTools([tool1, server]), [tool1, server])
    ).toBe(false);

    await expect(
      shouldBindTools(model.bindTools([tool1]), [tool1, server])
    ).rejects.toThrow();

    await expect(
      shouldBindTools(model.bindTools([server]), [tool1, server])
    ).rejects.toThrow();
  });
});

describe("hasSupportForJsonSchemaOutput", () => {
  it("should return false for undefined model", () => {
    expect(hasSupportForJsonSchemaOutput(undefined)).toBe(false);
  });

  it("should return true for models that support JSON schema output", () => {
    const model = new FakeToolCallingModel({});
    expect(hasSupportForJsonSchemaOutput(model)).toBe(false);
    const model2 = new FakeToolCallingChatModel({});
    expect(hasSupportForJsonSchemaOutput(model2)).toBe(true);
  });

  it("should return true for OpenAI models that support JSON schema output", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
    });
    expect(hasSupportForJsonSchemaOutput(model)).toBe(true);
    expect(hasSupportForJsonSchemaOutput("openai:gpt-4o")).toBe(true);
    expect(hasSupportForJsonSchemaOutput("gpt-4o-mini")).toBe(true);
  });

  it("should return false for OpenAI models that do not support JSON schema output", () => {
    const model = new ChatOpenAI({
      model: "gpt-3.5-turbo",
    });
    expect(hasSupportForJsonSchemaOutput(model)).toBe(false);
    expect(hasSupportForJsonSchemaOutput("openai:gpt-3.5-turbo")).toBe(false);
    expect(hasSupportForJsonSchemaOutput("gpt-3.5-turbo")).toBe(false);
  });

  it("should return false for Anthropic models that don't support JSON schema output", () => {
    const model = new ChatAnthropic({
      model: "claude-3-5-sonnet-20240620",
    });
    expect(hasSupportForJsonSchemaOutput(model)).toBe(false);
    expect(
      hasSupportForJsonSchemaOutput("anthropic:claude-3-5-sonnet-20240620")
    ).toBe(false);
    expect(hasSupportForJsonSchemaOutput("claude-3-5-sonnet-20240620")).toBe(
      false
    );
  });

  it("should return true for XAI models that support JSON schema output", () => {
    const model = new ChatXAI({
      model: "grok-beta",
      apiKey: process.env.XAI_API_KEY ?? "foo",
    });
    expect(hasSupportForJsonSchemaOutput(model)).toBe(true);
    expect(hasSupportForJsonSchemaOutput("xai:grok-beta")).toBe(true);
    expect(hasSupportForJsonSchemaOutput("grok-beta")).toBe(true);
  });
});
