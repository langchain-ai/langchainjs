import { describe, expect, it } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { tool } from "@langchain/core/tools";
import { createAgent, createMiddleware } from "../index.js";

describe.each([0, 1])("afterAgent jumps from middleware %i", (jumpIndex) => {
  it.each([true, false])(
    "continues the model loop with beforeModel hooks present: %s",
    async (withBeforeModel) => {
      const visits: string[] = [];
      let continued = false;
      const middleware = ["First", "Second"].map((name, index) =>
        createMiddleware({
          name,
          beforeAgent: () => {
            visits.push(`beforeAgent:${name}`);
          },
          beforeModel: withBeforeModel
            ? () => {
                visits.push(`beforeModel:${name}`);
              }
            : undefined,
          afterModel: () => {
            visits.push(`afterModel:${name}`);
          },
          afterAgent: {
            canJumpTo: ["model"],
            hook: () => {
              visits.push(`afterAgent:${name}`);
              if (index === jumpIndex && !continued) {
                continued = true;
                return { jumpTo: "model" as const };
              }
              return undefined;
            },
          },
        })
      );
      const agent = createAgent({
        model: fakeModel()
          .respond(new AIMessage("First response"))
          .respond(new AIMessage("Second response")),
        middleware,
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Continue once")],
      });

      const beforeModel = withBeforeModel
        ? ["beforeModel:First", "beforeModel:Second"]
        : [];
      const afterModel = ["afterModel:Second", "afterModel:First"];
      const afterAgent = ["afterAgent:Second", "afterAgent:First"];
      expect(visits).toEqual([
        "beforeAgent:First",
        "beforeAgent:Second",
        ...beforeModel,
        ...afterModel,
        ...(jumpIndex === 1 ? ["afterAgent:Second"] : afterAgent),
        ...beforeModel,
        ...afterModel,
        ...afterAgent,
      ]);
      expect(result.messages.map((message) => message.content)).toEqual([
        "Continue once",
        "First response",
        "Second response",
      ]);
    }
  );

  it("preserves an explicit end jump", async () => {
    const visits: string[] = [];
    const agent = createAgent({
      model: fakeModel().respond(new AIMessage("Done")),
      middleware: ["First", "Second"].map((name, index) =>
        createMiddleware({
          name,
          beforeModel: () => {
            visits.push(`beforeModel:${name}`);
          },
          afterAgent: {
            canJumpTo: ["model", "end"],
            hook: () => {
              visits.push(`afterAgent:${name}`);
              if (index === jumpIndex) {
                return { jumpTo: "end" as const };
              }
              return undefined;
            },
          },
        })
      ),
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Finish")],
    });

    expect(visits).toEqual([
      "beforeModel:First",
      "beforeModel:Second",
      "afterAgent:Second",
      ...(jumpIndex === 0 ? ["afterAgent:First"] : []),
    ]);
    expect(result.messages.at(-1)?.content).toBe("Done");
  });

  it("preserves an explicit tools jump and the subsequent model loop", async () => {
    let continued = false;
    let toolCalls = 0;
    const agent = createAgent({
      model: fakeModel()
        .respond(new AIMessage("First response"))
        .respond(new AIMessage("Second response")),
      tools: [
        tool(
          async () => {
            toolCalls += 1;
            return "Tool result";
          },
          { name: "continue_tool", description: "Continue the agent" }
        ),
      ],
      middleware: ["First", "Second"].map((name, index) =>
        createMiddleware({
          name,
          beforeModel: () => {},
          afterAgent: {
            canJumpTo: ["model", "tools"],
            hook: () => {
              if (index === jumpIndex && !continued) {
                continued = true;
                return {
                  jumpTo: "tools" as const,
                  messages: [
                    new AIMessage({
                      content: "",
                      tool_calls: [
                        { name: "continue_tool", args: {}, id: "continue" },
                      ],
                    }),
                  ],
                };
              }
              return undefined;
            },
          },
        })
      ),
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Continue via a tool")],
    });

    expect(toolCalls).toBe(1);
    expect(
      result.messages.filter(ToolMessage.isInstance).map((message) => ({
        content: message.content,
        id: message.tool_call_id,
      }))
    ).toEqual([{ content: "Tool result", id: "continue" }]);
    expect(result.messages.at(-1)?.content).toBe("Second response");
  });
});
