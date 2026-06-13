import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { fakeModel } from "@langchain/core/testing";

import { createAgent } from "../../index.js";
import type { SubagentRunStream } from "../index.js";

/**
 * Tests for `run.subagents`. A subagent is a nested `createAgent({ name })`
 * dispatched from a tool body. The native subagent transformer surfaces each
 * one as a typed `SubagentRunStream` with a resolved `name` and the triggering
 * tool call as its `cause`.
 */
describe("run.subagents", () => {
  function makeSupervisor() {
    const weatherAgent = createAgent({
      model: fakeModel().respond(new AIMessage("It is sunny in SF.")),
      tools: [],
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
    for await (const sub of run.subagents) {
      handles.push(sub);
    }

    expect(handles).toHaveLength(1);
    expect(handles[0].name).toBe("weather_agent");
    expect(handles[0].cause).toEqual({
      type: "toolCall",
      tool_call_id: "call_w",
    });
  });

  it("exposes scoped messages and output on the subagent handle", async () => {
    const supervisor = makeSupervisor();
    const run = await supervisor.streamEvents(
      { messages: [new HumanMessage("What is the weather in SF?")] },
      { version: "v3" }
    );

    // Collect handles (drives the run); the subagent's projections buffer, so
    // they can be drained afterwards from their replayable channels.
    const handles: SubagentRunStream[] = [];
    for await (const sub of run.subagents) {
      handles.push(sub);
    }
    expect(handles).toHaveLength(1);

    const texts: string[] = [];
    for await (const msgStream of handles[0].messages) {
      for await (const event of msgStream) {
        if (event.event !== "content-block-delta") continue;
        const delta = (event as { delta?: { type?: string; text?: string } })
          .delta;
        if (delta?.type === "text-delta" && delta.text != null) {
          texts.push(delta.text);
        }
      }
    }

    const output = (await handles[0].output) as { messages: unknown[] };
    expect(Array.isArray(output.messages)).toBe(true);
    expect(texts.join("")).toContain("sunny");
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
