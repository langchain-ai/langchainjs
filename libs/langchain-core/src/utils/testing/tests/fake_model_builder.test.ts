import { describe, test, expect } from "vitest";
import { AIMessage, HumanMessage } from "../../../messages/index.js";
import { RunnableBinding } from "../../../runnables/base.js";
import { tool } from "../../../tools/index.js";
import { z } from "zod/v3";
import { fakeModel } from "../index.js";

const dummyTool = tool(async () => "dummy result", {
  name: "dummy",
  description: "A dummy tool",
  schema: z.object({ input: z.string() }),
});

describe("fakeModel", () => {
  describe(".respondWithTools()", () => {
    test("returns correct tool calls per invocation", async () => {
      const model = fakeModel()
        .respondWithTools([
          { name: "search", args: { query: "weather" }, id: "1" },
        ])
        .respond(new AIMessage("The weather is sunny"));

      const r1 = await model.invoke([new HumanMessage("Hello")]);
      expect(r1.tool_calls).toHaveLength(1);
      expect(r1.tool_calls?.[0]?.name).toBe("search");
      expect(r1.tool_calls?.[0]?.args).toEqual({ query: "weather" });

      const r2 = await model.invoke([new HumanMessage("Hi again")]);
      expect(r2.content).toBe("The weather is sunny");
      expect(r2.tool_calls ?? []).toHaveLength(0);
    });

    test("derives content from input messages", async () => {
      const model = fakeModel().respondWithTools([]);

      const result = await model.invoke([new HumanMessage("Hello world")]);
      expect(result.content).toBe("Hello world");
    });

    test("concatenates multi-message content", async () => {
      const model = fakeModel().respondWithTools([]);

      const result = await model.invoke([
        new HumanMessage("first"),
        new HumanMessage("second"),
      ]);
      expect(result.content).toBe("first-second");
    });

    test("auto-generates tool call IDs when not provided", async () => {
      const model = fakeModel().respondWithTools([
        { name: "search", args: { query: "test" } },
      ]);

      const result = await model.invoke([new HumanMessage("go")]);
      expect(result.tool_calls?.[0]?.id).toBeDefined();
      expect(typeof result.tool_calls?.[0]?.id).toBe("string");
    });
  });

  describe(".respond()", () => {
    test("returns pre-built messages in order", async () => {
      const model = fakeModel()
        .respond(new AIMessage("first response"))
        .respond(new AIMessage("second response"));

      const r1 = await model.invoke([new HumanMessage("a")]);
      expect(r1.content).toBe("first response");

      const r2 = await model.invoke([new HumanMessage("b")]);
      expect(r2.content).toBe("second response");
    });

    test("returns messages with tool calls", async () => {
      const msg = new AIMessage({
        content: "calling tool",
        tool_calls: [
          {
            name: "search",
            args: { q: "test" },
            id: "tc1",
            type: "tool_call",
          },
        ],
      });
      const model = fakeModel().respond(msg);

      const result = await model.invoke([new HumanMessage("go")]);
      expect(result.content).toBe("calling tool");
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls?.[0]?.name).toBe("search");
    });

    test("throws when given an Error", async () => {
      const model = fakeModel().respond(new Error("rate limit"));

      await expect(model.invoke([new HumanMessage("a")])).rejects.toThrow(
        "rate limit"
      );
    });

    test("supports factory functions", async () => {
      const model = fakeModel().respond((messages) => {
        const lastContent = messages[messages.length - 1].content as string;
        return new AIMessage(`Echo: ${lastContent}`);
      });

      const result = await model.invoke([new HumanMessage("hello")]);
      expect(result.content).toBe("Echo: hello");
    });

    test("factory functions can return errors", async () => {
      const model = fakeModel().respond((messages) => {
        const content = messages[messages.length - 1].content as string;
        if (content === "fail") {
          return new Error("factory error");
        }
        return new AIMessage("ok");
      });

      await expect(model.invoke([new HumanMessage("fail")])).rejects.toThrow(
        "factory error"
      );
    });
  });

  describe("mixed sequencing", () => {
    test("respondWithTools and respond can be interleaved", async () => {
      const model = fakeModel()
        .respondWithTools([
          { name: "search", args: { query: "weather" }, id: "tc1" },
        ])
        .respond(
          new AIMessage({
            content: "Checking another source.",
            tool_calls: [
              {
                name: "lookup",
                args: { topic: "forecast" },
                id: "tc2",
                type: "tool_call",
              },
            ],
          })
        )
        .respond(new AIMessage("Forecast: sunny and warm."));

      const r1 = await model.invoke([new HumanMessage("weather?")]);
      expect(r1.tool_calls?.[0]?.name).toBe("search");

      const r2 = await model.invoke([new HumanMessage("got results")]);
      expect(r2.content).toBe("Checking another source.");
      expect(r2.tool_calls?.[0]?.name).toBe("lookup");

      const r3 = await model.invoke([new HumanMessage("got more results")]);
      expect(r3.content).toBe("Forecast: sunny and warm.");
      expect(r3.tool_calls ?? []).toHaveLength(0);
    });

    test("errors can appear anywhere in the sequence", async () => {
      const model = fakeModel()
        .respond(new Error("rate limit"))
        .respondWithTools([
          { name: "search", args: { query: "retry" }, id: "1" },
        ])
        .respond(new AIMessage("done"));

      await expect(model.invoke([new HumanMessage("a")])).rejects.toThrow(
        "rate limit"
      );

      const r2 = await model.invoke([new HumanMessage("b")]);
      expect(r2.tool_calls?.[0]?.name).toBe("search");

      const r3 = await model.invoke([new HumanMessage("c")]);
      expect(r3.content).toBe("done");
    });
  });

  describe("queue exhaustion", () => {
    test("throws when invoked beyond queued responses", async () => {
      const model = fakeModel().respond(new AIMessage("only one"));

      await model.invoke([new HumanMessage("a")]);
      await expect(model.invoke([new HumanMessage("b")])).rejects.toThrow(
        "no response queued for invocation 1"
      );
    });
  });

  describe("no-build required", () => {
    test("model is usable directly without .build()", async () => {
      const model = fakeModel().respond(new AIMessage("works"));

      const result = await model.invoke([new HumanMessage("hi")]);
      expect(result.content).toBe("works");
    });
  });

  describe(".alwaysThrow()", () => {
    test("every call throws", async () => {
      const model = fakeModel().alwaysThrow(new Error("always"));

      await expect(model.invoke([new HumanMessage("a")])).rejects.toThrow(
        "always"
      );

      await expect(model.invoke([new HumanMessage("b")])).rejects.toThrow(
        "always"
      );
    });
  });

  describe("call recording", () => {
    test("records every invocation", async () => {
      const model = fakeModel()
        .respond(new AIMessage("first"))
        .respond(new AIMessage("second"));

      await model.invoke([new HumanMessage("first")]);
      await model.invoke([new HumanMessage("second")]);

      expect(model.calls).toHaveLength(2);
      expect(model.callCount).toBe(2);
      expect(model.calls[0].messages[0].content).toBe("first");
      expect(model.calls[1].messages[0].content).toBe("second");
    });

    test("records thrown calls too", async () => {
      const model = fakeModel()
        .respond(new Error("boom"))
        .respond(new AIMessage("ok"));

      await expect(
        model.invoke([new HumanMessage("will fail")])
      ).rejects.toThrow();

      expect(model.calls).toHaveLength(1);
      expect(model.calls[0].messages[0].content).toBe("will fail");
    });

    test("records alwaysThrow calls", async () => {
      const model = fakeModel().alwaysThrow(new Error("nope"));

      await expect(model.invoke([new HumanMessage("try")])).rejects.toThrow();

      expect(model.callCount).toBe(1);
    });
  });

  describe("bindTools", () => {
    test("returns a RunnableBinding", () => {
      const model = fakeModel().respond(new AIMessage("hi"));
      const bound = model.bindTools([dummyTool]);
      expect(RunnableBinding.isRunnableBinding(bound)).toBe(true);
    });

    test("preserves response sequence across bindTools", async () => {
      const model = fakeModel()
        .respondWithTools([{ name: "search", args: {}, id: "1" }])
        .respond(new AIMessage("done"));

      const bound = model.bindTools([dummyTool]);

      const r1 = await bound.invoke([new HumanMessage("a")]);
      expect(r1.tool_calls?.[0]?.name).toBe("search");

      const r2 = await bound.invoke([new HumanMessage("b")]);
      expect(r2.content).toBe("done");
    });

    test("shares call recording across bindTools", async () => {
      const model = fakeModel().respond(new AIMessage("hi"));
      const bound = model.bindTools([dummyTool]);

      await bound.invoke([new HumanMessage("via bound")]);

      expect(model.calls).toHaveLength(1);
    });
  });

  describe(".structuredResponse()", () => {
    test("withStructuredOutput returns configured value", async () => {
      const model = fakeModel()
        .structuredResponse({ temperature: 72, unit: "fahrenheit" })
        .respond(new AIMessage("unused"));

      const structured = model.withStructuredOutput(z.object({}));
      const result = await structured.invoke([new HumanMessage("weather?")]);
      expect(result).toEqual({ temperature: 72, unit: "fahrenheit" });
    });
  });
});
