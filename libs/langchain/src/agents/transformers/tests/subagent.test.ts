import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { tool } from "@langchain/core/tools";
import { fakeModel, langchainMatchers } from "@langchain/core/testing";

import { createAgent } from "../../index.js";
import type { SubagentRunStream } from "../index.js";

expect.extend(langchainMatchers);

const randomToolCall = tool(() => "A random result", {
  name: "random_tool_call",
  description: "A tool that returns a random result",
  schema: z.object({}),
});

/**
 * Tests for `run.subagents`. A subagent is a nested `createAgent({ name })`
 * dispatched from a tool body. The native subagent transformer surfaces each
 * one as a typed `SubagentRunStream` with a resolved `name` and the triggering
 * tool call as its `cause`.
 */
describe("run.subagents", () => {
  function makeSupervisor() {
    const weatherAgent = createAgent({
      model: fakeModel()
        .respondWithTools([
          { name: "random_tool_call", args: {}, id: "call_r" },
        ])
        .respond(new AIMessage("It is sunny in SF.")),
      tools: [randomToolCall],
      name: "weather_agent",
    });

    const callWeather = tool(
      async () => {
        const res = await weatherAgent.invoke({
          messages: [new HumanMessage("weather in SF?")],
        });
        const last = res.messages.at(-1);
        return typeof last?.content === "string" ? last.content : "ok";
      },
      {
        name: "call_weather",
        description: "Ask the weather sub-agent",
        schema: z.object({}),
      }
    );

    return createAgent({
      model: fakeModel()
        .respondWithTools([{ name: "call_weather", args: {}, id: "call_w" }])
        .respond(new AIMessage("Done.")),
      tools: [callWeather],
      name: "supervisor",
    });
  }

  /**
   * Builds a three-level hierarchy: `supervisor` dispatches `weather_agent`
   * (via `call_weather`), which itself dispatches `geo_agent` (via `call_geo`).
   * The grandchild surfaces on the child handle's own `subagents` projection.
   */
  function makeNestedSupervisor() {
    const geoAgent = createAgent({
      model: fakeModel()
        .respondWithTools([
          { name: "random_tool_call", args: {}, id: "call_r" },
        ])
        .respond(new AIMessage("SF is at 37.77, -122.41.")),
      tools: [randomToolCall],
      name: "geo_agent",
    });

    const callGeo = tool(
      async () => {
        const res = await geoAgent.invoke({
          messages: [new HumanMessage("coordinates of SF?")],
        });
        const last = res.messages.at(-1);
        return typeof last?.content === "string" ? last.content : "ok";
      },
      {
        name: "call_geo",
        description: "Ask the geo sub-agent",
        schema: z.object({}),
      }
    );

    const weatherAgent = createAgent({
      model: fakeModel()
        .respondWithTools([{ name: "call_geo", args: {}, id: "call_g" }])
        .respond(new AIMessage("It is sunny in SF.")),
      tools: [callGeo],
      name: "weather_agent",
    });

    const callWeather = tool(
      async () => {
        const res = await weatherAgent.invoke({
          messages: [new HumanMessage("weather in SF?")],
        });
        const last = res.messages.at(-1);
        return typeof last?.content === "string" ? last.content : "ok";
      },
      {
        name: "call_weather",
        description: "Ask the weather sub-agent",
        schema: z.object({}),
      }
    );

    return createAgent({
      model: fakeModel()
        .respondWithTools([{ name: "call_weather", args: {}, id: "call_w" }])
        .respond(new AIMessage("Done.")),
      tools: [callWeather],
      name: "supervisor",
    });
  }

  it("surfaces a named subagent dispatched from a tool with its cause", async () => {
    const supervisor = makeSupervisor();
    const run = await supervisor.streamEvents(
      { messages: [new HumanMessage("What is the weather in SF?")] },
      { version: "v3" }
    );

    // Draining `run.subagents` drives the underlying stream to completion.
    const handles: SubagentRunStream[] = [];
    const subHandles: SubagentRunStream[] = [];
    for await (const sub of run.subagents) {
      handles.push(sub);
      expect(sub.name).toBe("weather_agent");
      expect(sub.cause).toEqual({
        type: "toolCall",
        tool_call_id: "call_w",
      });

      const messages: string[] = [];
      const events: ChatModelStreamEvent[] = [];
      for await (const message of sub.messages) {
        messages.push(await message.text);

        for await (const event of message) {
          events.push(event);
        }
      }
      expect(messages).toHaveLength(1);
      expect(messages.join("")).toBe("It is sunny in SF.");
      expect(events).toHaveLength(5);
      expect(events[0].event).toBe("message-start");
      expect(events[1].event).toBe("content-block-start");
      expect(events[2].event).toBe("content-block-delta");
      expect(events[3].event).toBe("content-block-finish");
      expect(events[4].event).toBe("message-finish");

      const toolCalls: string[] = [];
      for await (const toolCall of sub.toolCalls) {
        toolCalls.push(await toolCall.name);
      }
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toBe("random_tool_call");

      for await (const child of sub.subagents) {
        subHandles.push(child);
      }
    }

    expect(handles).toHaveLength(1);
    const lastMessage = (await run.output).messages.at(-1);
    expect(lastMessage).toBeAIMessage("Done.");

    expect(subHandles).toHaveLength(0);
  });

  it("iterates nested subagents via sub.subagents", async () => {
    const supervisor = makeNestedSupervisor();
    const run = await supervisor.streamEvents(
      { messages: [new HumanMessage("What is the weather in SF?")] },
      { version: "v3" }
    );

    // Draining the top-level stream drives the run to completion; each handle's
    // nested `subagents` channel is replayable, so grandchildren can be drained
    // from within the same pass.
    const top: SubagentRunStream[] = [];
    const nested: SubagentRunStream[] = [];
    for await (const sub of run.subagents) {
      top.push(sub);
      for await (const child of sub.subagents) {
        nested.push(child);
      }

      const output = await sub.output;
      expect(output.messages[0]).toBeHumanMessage("weather in SF?");
      expect(output.messages[1]).toBeAIMessage({ name: "weather_agent" });
      expect(output.messages[2]).toBeToolMessage("SF is at 37.77, -122.41.");
      expect(output.messages[3]).toBeAIMessage("It is sunny in SF.");
    }

    expect(top).toHaveLength(1);
    expect(top[0].name).toBe("weather_agent");

    expect(nested).toHaveLength(1);
    expect(nested[0].name).toBe("geo_agent");
    expect(nested[0].cause).toEqual({
      type: "toolCall",
      tool_call_id: "call_g",
    });

    const geoOutput = (await nested[0].output) as { messages: BaseMessage[] };
    expect(Array.isArray(geoOutput.messages)).toBe(true);
    expect(geoOutput.messages).toHaveLength(4);
    expect(geoOutput.messages[0]).toBeHumanMessage("coordinates of SF?");
    expect(geoOutput.messages[1]).toBeAIMessage({ name: "geo_agent" });
    expect(geoOutput.messages[2]).toBeToolMessage("A random result");
    expect(geoOutput.messages[3]).toBeAIMessage("SF is at 37.77, -122.41.");

    for await (const toolCall of nested[0].toolCalls) {
      expect(toolCall.name).toBe("random_tool_call");
    }
  });

  it("does not surface subagents for an agent with no nested named agents", async () => {
    const echo = tool(() => "ok", {
      name: "echo",
      description: "echoes",
      schema: z.object({}),
    });
    const agent = createAgent({
      model: fakeModel()
        .respondWithTools([{ name: "echo", args: {}, id: "call_e" }])
        .respond(new AIMessage("done")),
      tools: [echo],
      name: "plain",
    });

    const run = await agent.streamEvents(
      { messages: [new HumanMessage("hi")] },
      { version: "v3" }
    );

    const handles: SubagentRunStream[] = [];
    for await (const sub of run.subagents) {
      handles.push(sub);
    }
    expect(handles).toHaveLength(0);
  });
});
