import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { Runtime, MessagesAnnotation, Annotation } from "@langchain/langgraph";

import { createReactAgent } from "../index.js";

import { FakeToolCallingChatModel } from "./utils.js";

describe("Dynamic Model", () => {
  it("should handle basic dynamic model functionality", async () => {
    const dynamicModel = (state: typeof MessagesAnnotation.State) => {
      // Return different models based on state
      if (state.messages.at(-1)?.text.includes("urgent")) {
        return new FakeToolCallingChatModel({
          responses: [new AIMessage("urgent called")],
        });
      }

      return new FakeToolCallingChatModel({ responses: [] });
    };

    const agent = createReactAgent({ llm: dynamicModel, tools: [] });

    const result = await agent.invoke({ messages: "hello" });
    expect(result.messages.at(-1)?.text).toBe("hello");

    const result2 = await agent.invoke({ messages: "urgent help" });
    expect(result2.messages.at(-1)?.text).toBe("urgent called");
  });

  it("should handle dynamic model with tool calling", async () => {
    const basicModel = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [{ args: { x: 1 }, id: "1", name: "basic_tool" }],
        }),
        new AIMessage("basic request"),
      ],
    });

    const basicTool = tool(async (args: { x: number }) => `basic: ${args.x}`, {
      name: "basic_tool",
      description: "Basic tool.",
      schema: z.object({ x: z.number() }),
    });

    const advancedModel = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [{ args: { x: 1 }, id: "1", name: "advanced_tool" }],
        }),
        new AIMessage("advanced request"),
      ],
    });

    const advancedTool = tool(
      async (args: { x: number }) => `advanced: ${args.x}`,
      {
        name: "advanced_tool",
        description: "Advanced tool.",
        schema: z.object({ x: z.number() }),
      }
    );

    const dynamicModel = (state: typeof MessagesAnnotation.State) => {
      // Return model with different behaviors based on message content
      if (state.messages.at(-1)?.text.includes("advanced")) {
        return advancedModel;
      }

      return basicModel;
    };

    const agent = createReactAgent({
      llm: dynamicModel,
      tools: [basicTool, advancedTool],
    });

    // Test basic tool usage
    const result = await agent.invoke({ messages: "basic request" });
    expect(result.messages.slice(-2)).toMatchObject([
      { text: "basic: 1", name: "basic_tool" },
      { text: "basic request" },
    ]);

    // Test advanced tool usage
    const result2 = await agent.invoke({ messages: "advanced request" });
    expect(result2.messages.slice(-2)).toMatchObject([
      { text: "advanced: 1", name: "advanced_tool" },
      { text: "advanced request" },
    ]);
  });

  it("should handle dynamic model using config parameters", async () => {
    const context = z.object({ user_id: z.string() });

    const dynamicModel = (
      _: typeof MessagesAnnotation.State,
      runtime: Runtime<z.infer<typeof context>>
    ) => {
      // Use context to determine model behavior
      const user_id = runtime.context?.user_id;
      if (user_id === "user_premium") {
        return new FakeToolCallingChatModel({
          responses: [new AIMessage("premium")],
        });
      }

      return new FakeToolCallingChatModel({
        responses: [new AIMessage("basic")],
      });
    };

    const agent = createReactAgent({
      llm: dynamicModel,
      tools: [],
      contextSchema: context,
    });

    // Test with basic user
    expect(
      await agent.invoke(
        { messages: "hello" },
        { context: { user_id: "user_basic" } }
      )
    ).toMatchObject({
      messages: [{ text: "hello" }, { text: "basic" }],
    });

    // Test with premium user
    expect(
      await agent.invoke(
        { messages: "hello" },
        { context: { user_id: "user_premium" } }
      )
    ).toMatchObject({
      messages: [{ text: "hello" }, { text: "premium" }],
    });
  });

  it("should handle dynamic model with custom state schema", async () => {
    const CustomDynamicState = Annotation.Root({
      messages: MessagesAnnotation.spec.messages,
      model_preference: Annotation<"basic" | "advanced">({
        reducer: (_, next) => next,
        default: () => "basic",
      }),
    });

    const dynamicModel = (state: typeof CustomDynamicState.State) => {
      // Use custom state field to determine model
      if (state.model_preference === "advanced") {
        return new FakeToolCallingChatModel({
          responses: [new AIMessage("advanced")],
        });
      }

      return new FakeToolCallingChatModel({
        responses: [new AIMessage("basic")],
      });
    };

    const agent = createReactAgent({
      llm: dynamicModel,
      tools: [],
      stateSchema: CustomDynamicState,
    });

    expect(
      await agent.invoke({
        messages: [new HumanMessage("hello")],
        model_preference: "advanced",
      })
    ).toMatchObject({
      messages: [{ text: "hello" }, { text: "advanced" }],
    });
  });

  it("should handle dynamic model with different prompt types", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("ai response")],
    });
    const spyInvoke = vi.spyOn(model, "invoke");

    // Test with string prompt
    const agent = createReactAgent({
      llm: () => model,
      tools: [],
      prompt: "system_msg",
    });

    expect(await agent.invoke({ messages: "human_msg" })).toMatchObject({
      messages: [{ text: "human_msg" }, { text: "ai response" }],
    });

    expect(spyInvoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ text: "system_msg" }),
        expect.objectContaining({ text: "human_msg" }),
      ]),
      expect.any(Object)
    );

    spyInvoke.mockClear();

    // Test with callable prompt
    const dynamicPrompt = (state: typeof MessagesAnnotation.State) => {
      return [new SystemMessage("system_msg"), ...state.messages];
    };

    const agent2 = createReactAgent({
      llm: () => model,
      tools: [],
      prompt: dynamicPrompt,
    });

    expect(await agent2.invoke({ messages: "human_msg" })).toMatchObject({
      messages: [{ text: "human_msg" }, { text: "ai response" }],
    });

    expect(spyInvoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ text: "system_msg" }),
        expect.objectContaining({ text: "human_msg" }),
      ]),
      expect.any(Object)
    );
  });

  it("should handle dynamic model that changes available tools based on state", async () => {
    const toolA = tool(async (args: { x: number }) => `A: ${args.x}`, {
      name: "tool_a",
      description: "Tool A.",
      schema: z.object({ x: z.number() }),
    });

    const modelA = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [{ args: { x: 1 }, id: "1", name: "tool_a" }],
        }),
        new AIMessage({ content: "use_a please" }),
      ],
    });

    const toolB = tool(async (args: { x: number }) => `B: ${args.x}`, {
      name: "tool_b",
      description: "Tool B.",
      schema: z.object({ x: z.number() }),
    });

    const modelB = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [{ args: { x: 2 }, id: "1", name: "tool_b" }],
        }),
        new AIMessage({ content: "use_b please" }),
      ],
    });

    const dynamicModel = (state: typeof MessagesAnnotation.State) => {
      // Switch tools based on message history
      if (state.messages.some((msg) => msg.text.includes("use_b"))) {
        return modelB;
      }

      return modelA;
    };

    const agent = createReactAgent({
      llm: dynamicModel,
      tools: [toolA, toolB],
    });

    // Ask to use tool A
    expect(await agent.invoke({ messages: "use_a" })).toMatchObject({
      messages: [
        { text: "use_a" },
        { tool_calls: [{ args: { x: 1 }, name: "tool_a" }] },
        { text: "A: 1" },
        { text: "use_a please" },
      ],
    });

    // Ask to use tool B
    expect(await agent.invoke({ messages: "use_b" })).toMatchObject({
      messages: [
        { text: "use_b" },
        { tool_calls: [{ args: { x: 2 }, name: "tool_b" }] },
        { text: "B: 2" },
        { text: "use_b please" },
      ],
    });
  });

  it("should handle error handling in dynamic model", async () => {
    const failingDynamicModel = (state: typeof MessagesAnnotation.State) => {
      if (state.messages.at(-1)?.text.includes("fail")) {
        throw new Error("Dynamic model failed");
      }

      return new FakeToolCallingChatModel({
        responses: [new AIMessage("ai response")],
      });
    };

    const agent = createReactAgent({
      llm: failingDynamicModel,
      tools: [],
    });

    // Normal operation should work
    expect(await agent.invoke({ messages: "hello" })).toMatchObject({
      messages: [{ text: "hello" }, { text: "ai response" }],
    });

    // Should propagate the error
    await expect(
      agent.invoke({ messages: [new HumanMessage("fail now")] })
    ).rejects.toThrow("Dynamic model failed");
  });

  it("should produce equivalent results when configured the same", async () => {
    // Static model
    const staticAgent = createReactAgent({
      llm: new FakeToolCallingChatModel({
        responses: [new AIMessage("ai response")],
      }),
      tools: [],
    });

    // Dynamic model returning the same model
    const dynamicAgent = createReactAgent({
      llm: () =>
        new FakeToolCallingChatModel({
          responses: [new AIMessage("ai response")],
        }),
      tools: [],
    });

    const inputMsg = { messages: "test message" };

    const staticResult = await staticAgent.invoke(inputMsg);
    const dynamicResult = await dynamicAgent.invoke(inputMsg);

    // Results should be equivalent (content-wise, IDs may differ)
    expect(staticResult.messages.length).toEqual(dynamicResult.messages.length);
    expect(staticResult.messages[0].text).toEqual(
      dynamicResult.messages[0].text
    );
    expect(staticResult.messages[1].text).toEqual(
      dynamicResult.messages[1].text
    );
  });

  it("should receive correct state, not the model input", async () => {
    const CustomAgentState = Annotation.Root({
      messages: MessagesAnnotation.spec.messages,
      custom_field: Annotation<string>,
    });

    const dynamicModel = vi.fn(
      () =>
        new FakeToolCallingChatModel({
          responses: [new AIMessage("ai response")],
        })
    );

    const agent = createReactAgent({
      llm: dynamicModel,
      tools: [],
      stateSchema: CustomAgentState,
    });

    // Test with initial state
    const inputState = {
      messages: [new HumanMessage("hello")],
      custom_field: "test_value",
    };
    await agent.invoke(inputState);

    // The dynamic model function should receive the original state, not the processed model input
    expect(dynamicModel).toHaveBeenCalledWith(inputState, expect.any(Object));
  });
});
