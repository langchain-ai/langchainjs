import { describe, test, expect } from "vitest";
import { AIMessage, HumanMessage } from "../../../messages/index.js";
import { RunnableBinding } from "../../../runnables/base.js";
import { StructuredTool } from "../../../tools/index.js";
import { z } from "zod/v3";
import { fakeModel } from "../index.js";

const dummyTool = new (class extends StructuredTool {
  name = "dummy";

  description = "A dummy tool";

  schema = z.object({ input: z.string() });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async _call(_input: any) {
    return "dummy result";
  }
})();

describe("fakeModel builder", () => {
  describe(".turn() mode", () => {
    test("returns correct tool calls per turn", async () => {
      const model = fakeModel()
        .turn([{ name: "search", args: { query: "weather" }, id: "1" }])
        .turn([])
        .build();

      const r1 = await model.invoke([new HumanMessage("Hello")]);
      expect(r1.tool_calls).toHaveLength(1);
      expect(r1.tool_calls?.[0]?.name).toBe("search");
      expect(r1.tool_calls?.[0]?.args).toEqual({ query: "weather" });

      const r2 = await model.invoke([new HumanMessage("Hi again")]);
      expect(r2.tool_calls ?? []).toHaveLength(0);
    });

    test("derives content from input messages", async () => {
      const model = fakeModel().turn([]).build();

      const result = await model.invoke([new HumanMessage("Hello world")]);
      expect(result.content).toBe("Hello world");
    });

    test("concatenates multi-message content", async () => {
      const model = fakeModel().turn([]).build();

      const result = await model.invoke([
        new HumanMessage("first"),
        new HumanMessage("second"),
      ]);
      expect(result.content).toBe("first-second");
    });

    test("advances index sequentially", async () => {
      const model = fakeModel()
        .turn([{ name: "a", args: {}, id: "1" }])
        .turn([{ name: "b", args: {}, id: "2" }])
        .turn([])
        .build();

      const r1 = await model.invoke([new HumanMessage("1")]);
      expect(r1.tool_calls?.[0]?.name).toBe("a");

      const r2 = await model.invoke([new HumanMessage("2")]);
      expect(r2.tool_calls?.[0]?.name).toBe("b");

      const r3 = await model.invoke([new HumanMessage("3")]);
      expect(r3.tool_calls ?? []).toHaveLength(0);
    });

    test("wraps around when turns are exhausted", async () => {
      const model = fakeModel()
        .turn([{ name: "a", args: {}, id: "1" }])
        .build();

      await model.invoke([new HumanMessage("1")]);
      const r2 = await model.invoke([new HumanMessage("2")]);
      expect(r2.tool_calls?.[0]?.name).toBe("a");
    });
  });

  describe(".respond() mode", () => {
    test("returns pre-built messages in order", async () => {
      const model = fakeModel()
        .respond(new AIMessage("first response"))
        .respond(new AIMessage("second response"))
        .build();

      const r1 = await model.invoke([new HumanMessage("a")]);
      expect(r1.content).toBe("first response");

      const r2 = await model.invoke([new HumanMessage("b")]);
      expect(r2.content).toBe("second response");
    });

    test("returns messages with tool calls", async () => {
      const msg = new AIMessage({
        content: "calling tool",
        tool_calls: [
          { name: "search", args: { q: "test" }, id: "tc1", type: "tool_call" },
        ],
      });
      const model = fakeModel().respond(msg).build();

      const result = await model.invoke([new HumanMessage("go")]);
      expect(result.content).toBe("calling tool");
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls?.[0]?.name).toBe("search");
    });

    test("wraps around when responses are exhausted", async () => {
      const model = fakeModel().respond(new AIMessage("only")).build();

      await model.invoke([new HumanMessage("1")]);
      const r2 = await model.invoke([new HumanMessage("2")]);
      expect(r2.content).toBe("only");
    });
  });

  describe("build-time validation", () => {
    test("throws when mixing .turn() and .respond()", () => {
      expect(() =>
        fakeModel().turn([]).respond(new AIMessage("hi")).build()
      ).toThrow("Cannot mix .turn() and .respond()");
    });

    test("throws when nothing is configured", () => {
      expect(() => fakeModel().build()).toThrow("Must configure at least one");
    });

    test("allows .alwaysThrow() without turns or responses", () => {
      expect(() =>
        fakeModel().alwaysThrow(new Error("boom")).build()
      ).not.toThrow();
    });
  });

  describe(".throwOnTurn()", () => {
    test("throws on specified calls, succeeds on others", async () => {
      const model = fakeModel()
        .throwOnTurn(0, new Error("fail 1"))
        .throwOnTurn(1, new Error("fail 2"))
        .turn([])
        .build();

      await expect(model.invoke([new HumanMessage("a")])).rejects.toThrow(
        "fail 1"
      );

      await expect(model.invoke([new HumanMessage("b")])).rejects.toThrow(
        "fail 2"
      );

      const result = await model.invoke([new HumanMessage("c")]);
      expect(result.content).toBe("c");
    });

    test("does not consume a response on thrown calls", async () => {
      const model = fakeModel()
        .throwOnTurn(0, new Error("fail"))
        .turn([{ name: "a", args: {}, id: "1" }])
        .turn([])
        .build();

      await expect(model.invoke([new HumanMessage("x")])).rejects.toThrow(
        "fail"
      );

      const r1 = await model.invoke([new HumanMessage("y")]);
      expect(r1.tool_calls?.[0]?.name).toBe("a");

      const r2 = await model.invoke([new HumanMessage("z")]);
      expect(r2.tool_calls ?? []).toHaveLength(0);
    });
  });

  describe(".alwaysThrow()", () => {
    test("every call throws", async () => {
      const model = fakeModel().alwaysThrow(new Error("always")).build();

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
      const model = fakeModel().turn([]).build();

      await model.invoke([new HumanMessage("first")]);
      await model.invoke([new HumanMessage("second")]);

      expect(model.calls).toHaveLength(2);
      expect(model.callCount).toBe(2);
      expect(model.calls[0].messages[0].content).toBe("first");
      expect(model.calls[1].messages[0].content).toBe("second");
    });

    test("records thrown calls too", async () => {
      const model = fakeModel()
        .throwOnTurn(0, new Error("boom"))
        .turn([])
        .build();

      await expect(
        model.invoke([new HumanMessage("will fail")])
      ).rejects.toThrow();

      expect(model.calls).toHaveLength(1);
      expect(model.calls[0].messages[0].content).toBe("will fail");
    });

    test("records alwaysThrow calls", async () => {
      const model = fakeModel().alwaysThrow(new Error("nope")).build();

      await expect(model.invoke([new HumanMessage("try")])).rejects.toThrow();

      expect(model.callCount).toBe(1);
    });
  });

  describe("bindTools", () => {
    test("returns a RunnableBinding", () => {
      const model = fakeModel().turn([]).build();
      const bound = model.bindTools([dummyTool]);
      expect(RunnableBinding.isRunnableBinding(bound)).toBe(true);
    });

    test("preserves turn sequence across bindTools", async () => {
      const model = fakeModel()
        .turn([{ name: "search", args: {}, id: "1" }])
        .turn([])
        .build();

      const bound = model.bindTools([dummyTool]);

      const r1 = await bound.invoke([new HumanMessage("a")]);
      expect(r1.tool_calls?.[0]?.name).toBe("search");

      const r2 = await bound.invoke([new HumanMessage("b")]);
      expect(r2.tool_calls ?? []).toHaveLength(0);
    });

    test("shares call recording across bindTools", async () => {
      const model = fakeModel().turn([]).build();
      const bound = model.bindTools([dummyTool]);

      await bound.invoke([new HumanMessage("via bound")]);

      expect(model.calls).toHaveLength(1);
    });
  });

  describe(".structuredResponse()", () => {
    test("withStructuredOutput returns configured value", async () => {
      const model = fakeModel()
        .structuredResponse({ temperature: 72, unit: "fahrenheit" })
        .turn([])
        .build();

      const structured = model.withStructuredOutput(z.object({}));
      const result = await structured.invoke([new HumanMessage("weather?")]);
      expect(result).toEqual({ temperature: 72, unit: "fahrenheit" });
    });
  });

  describe(".toolStyle()", () => {
    test("formats tools as openai by default", () => {
      const model = fakeModel().turn([]).build();
      const bound = model.bindTools([dummyTool]);

      expect(RunnableBinding.isRunnableBinding(bound)).toBe(true);
    });

    test("formats tools as anthropic", () => {
      const model = fakeModel().toolStyle("anthropic").turn([]).build();
      const bound = model.bindTools([dummyTool]);
      expect(RunnableBinding.isRunnableBinding(bound)).toBe(true);
    });
  });

  describe("no auto-reset", () => {
    test("does not reset index on new conversation", async () => {
      const model = fakeModel()
        .turn([{ name: "a", args: {}, id: "1" }])
        .turn([{ name: "b", args: {}, id: "2" }])
        .build();

      const r1 = await model.invoke([new HumanMessage("hello")]);
      expect(r1.tool_calls?.[0]?.name).toBe("a");

      const r2 = await model.invoke([new HumanMessage("new conversation")]);
      expect(r2.tool_calls?.[0]?.name).toBe("b");
    });
  });
});
