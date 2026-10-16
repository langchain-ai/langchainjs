import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v3";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import type { ToolCall } from "@langchain/core/messages/tool";
import {
  Command,
  GraphBubbleUp,
  GraphDrained,
  GraphInterrupt,
  NodeInterrupt,
  ParentCommand,
} from "@langchain/langgraph";

import {
  createAgent,
  createMiddleware,
  markToolErrorAsFatal,
  type AnyAgentMiddleware,
  type ToolCallRequest,
} from "../index.js";
import { ToolNode, type ToolNodeOptions } from "../nodes/ToolNode.js";
import { MiddlewareError } from "../errors.js";
import { wrapToolCall } from "../utils.js";
import { toolRetryMiddleware } from "../middleware/toolRetry.js";
import { toolErrorMiddleware } from "../middleware/toolError.js";
import { FakeToolCallingModel } from "./utils.js";

const passthrough = (name = "passthrough") =>
  createMiddleware({
    name,
    wrapToolCall: (request, handler) => handler(request),
  });
const failingTool = (error: unknown, name = "boom") =>
  tool(
    async () => {
      throw error;
    },
    {
      name,
      description: "A local failing tool",
      schema: z.object({}),
    }
  );
const input = (name = "boom") => ({
  messages: [
    new AIMessage({
      content: "",
      tool_calls: [{ name, args: {}, id: "call_1" }],
    }),
  ],
});
const node = (
  error: unknown,
  middleware: AnyAgentMiddleware[] = [passthrough()],
  options: ToolNodeOptions = {}
) =>
  new ToolNode([failingTool(error)], {
    wrapToolCall: wrapToolCall(middleware),
    ...options,
  });
const fatal = (copyRequest = false) =>
  createMiddleware({
    name: "fatal",
    wrapToolCall: async (request, handler) => {
      try {
        return await handler(request);
      } catch (error) {
        markToolErrorAsFatal(copyRequest ? { ...request } : request, error);
        throw error;
      }
    },
  });
const values = [
  new TypeError("tool failed"),
  Object.freeze(new Error("frozen")),
  "text",
  42,
  null,
  undefined,
];

describe("tool error provenance", () => {
  it.each(values)(
    "recovers an unchanged tool throw (%s) without mutating it",
    async (error) => {
      const observed: unknown[] = [];
      const observer = createMiddleware({
        name: "observer",
        wrapToolCall: async (request, handler) => {
          try {
            return await handler(request);
          } catch (caught) {
            observed.push(caught);
            throw caught;
          }
        },
      });
      const before =
        error && typeof error === "object" ? Reflect.ownKeys(error) : [];
      const result = await node(error, [passthrough(), observer]).invoke(
        input()
      );
      expect(result.messages[0]).toMatchObject({
        content: `${error}\n Please fix your mistakes.`,
        name: "boom",
        tool_call_id: "call_1",
        status: "error",
      });
      expect(observed).toEqual([error]);
      if (error && typeof error === "object")
        expect(Reflect.ownKeys(error)).toEqual(before);
    }
  );

  it.each(values)(
    "recovers ordinary throws before the whole-agent graph boundary (%s)",
    async (error) => {
      const agent = createAgent({
        model: new FakeToolCallingModel({
          toolCalls: [[{ name: "boom", args: {}, id: "call_1" }], []],
        }),
        tools: [failingTool(error)],
        middleware: [passthrough("outer"), passthrough("inner")],
      });
      const result = await agent.invoke({
        messages: [new HumanMessage("Use the tool")],
      });
      expect(result.messages.filter(ToolMessage.isInstance)[0]).toMatchObject({
        content: `${error}\n Please fix your mistakes.`,
        status: "error",
        tool_call_id: "call_1",
      });
    }
  );

  // Direct ToolNode boundary: LangGraph's scheduler currently mutates fatal
  // throws, so whole-agent frozen/primitive rejection identity is not asserted.
  it.each(values)(
    "preserves an explicitly fatal value at the ToolNode boundary (%s)",
    async (error) => {
      await expect(
        node(error, [passthrough(), fatal()]).invoke(input())
      ).rejects.toBe(error);
    }
  );

  it.each([false, true])(
    "supports fatal marks on the hook request or its spread copy (%s)",
    async (copy) => {
      const error = new Error("fatal");
      await expect(
        node(error, [fatal(copy), passthrough()]).invoke(input())
      ).rejects.toBe(error);
    }
  );

  it("restores private context when middleware reconstructs a request", async () => {
    const reconstruct = createMiddleware({
      name: "reconstruct",
      wrapToolCall: (request, handler) =>
        handler({
          toolCall: request.toolCall,
          tool: request.tool,
          state: request.state,
          runtime: request.runtime,
        }),
    });
    const error = new Error("fatal");
    await expect(
      node(error, [reconstruct, fatal()]).invoke(input())
    ).rejects.toBe(error);
  });

  it("preserves fatal intent across separately loaded module instances", async () => {
    vi.resetModules();
    const otherCopy = await import("../middleware/toolErrorContext.js");
    const error = new Error("shared module key");
    const middleware = createMiddleware({
      name: "otherCopy",
      wrapToolCall: async (request, handler) => {
        try {
          return await handler(request);
        } catch (caught) {
          otherCopy.markToolErrorAsFatal(request, caught);
          throw caught;
        }
      },
    });
    await expect(node(error, [middleware]).invoke(input())).rejects.toBe(error);
  });

  it("does nothing for a standalone request without a hook context", () => {
    const request: ToolCallRequest = {
      toolCall: { name: "boom", args: {}, id: "call_1" },
      tool: undefined,
      state: { messages: [] },
      runtime: {},
    };
    expect(
      markToolErrorAsFatal(request, Object.freeze(new Error("fatal")))
    ).toBeUndefined();
    expect(Reflect.ownKeys(request)).toEqual([
      "toolCall",
      "tool",
      "state",
      "runtime",
    ]);
  });

  it("cannot leak marks from retained requests into subsequent invocations", async () => {
    let retained: ToolCallRequest | undefined;
    const capture = createMiddleware({
      name: "capture",
      wrapToolCall: (request, handler) => {
        retained = request;
        return handler(request);
      },
    });
    const error = new Error("shared");
    const toolNode = node(error, [capture]);
    expect((await toolNode.invoke(input())).messages[0].status).toBe("error");
    markToolErrorAsFatal(retained!, error);
    expect((await toolNode.invoke(input())).messages[0].status).toBe("error");
  });

  it.each([undefined, false, true, "custom"] as const)(
    "preserves handleToolErrors precedence for fatal errors (%s)",
    async (mode) => {
      const error = new Error("fatal");
      const custom = vi.fn(
        () => new ToolMessage({ content: "custom", tool_call_id: "call_1" })
      );
      const toolNode = node(error, [fatal()], {
        handleToolErrors: mode === "custom" ? custom : mode,
      });
      if (mode === true) {
        expect((await toolNode.invoke(input())).messages[0].status).toBe(
          "error"
        );
      } else {
        await expect(toolNode.invoke(input())).rejects.toBe(error);
      }
      expect(custom).not.toHaveBeenCalled();
    }
  );

  it("passes unmarked tool errors to the custom handler with their original identity", async () => {
    const error = new Error("tool");
    const custom = vi.fn(
      (_error: unknown, call: ToolCall) =>
        new ToolMessage({ content: "custom", tool_call_id: call.id! })
    );
    expect(
      (
        await node(error, [passthrough()], { handleToolErrors: custom }).invoke(
          input()
        )
      ).messages[0]
    ).toMatchObject({ content: "custom", status: "error" });
    expect(custom).toHaveBeenCalledWith(error, {
      name: "boom",
      args: {},
      id: "call_1",
    });
    await expect(
      node(error, [passthrough()], { handleToolErrors: false }).invoke(input())
    ).rejects.toBe(error);
    await expect(
      node(error, [passthrough()], {
        handleToolErrors: () => undefined,
      }).invoke(input())
    ).rejects.toBe(error);
  });

  it("keeps middleware-origin errors fatal unless handleToolErrors is true", async () => {
    const error = new Error("middleware");
    const broken = createMiddleware({
      name: "broken",
      wrapToolCall: () => {
        throw error;
      },
    });
    const custom = vi.fn(() => undefined);
    await expect(
      node(error, [broken], { handleToolErrors: custom }).invoke(input())
    ).rejects.toMatchObject({ cause: error });
    expect(custom).not.toHaveBeenCalled();
    expect(
      (await node(error, [broken], { handleToolErrors: true }).invoke(input()))
        .messages[0].status
    ).toBe("error");
  });

  it.each(["node", "config"])(
    "never converts cancellation to a ToolMessage (%s signal)",
    async (source) => {
      const controller = new AbortController();
      const error = new Error("cancelled");
      const aborting = tool(
        async () => {
          controller.abort(error);
          throw error;
        },
        {
          name: "boom",
          description: "Cancels locally",
          schema: z.object({}),
        }
      );
      const toolNode = new ToolNode([aborting], {
        wrapToolCall: wrapToolCall([passthrough()]),
        handleToolErrors: true,
        ...(source === "node" ? { signal: controller.signal } : {}),
      });
      await expect(
        toolNode.invoke(
          input(),
          source === "config" ? { signal: controller.signal } : {}
        )
      ).rejects.toBe(error);
    }
  );

  it("never converts a marked GraphInterrupt, even with handleToolErrors true", async () => {
    const error = new GraphInterrupt([{ value: "approve" }]);
    await expect(
      node(error, [fatal()], { handleToolErrors: true }).invoke(input())
    ).rejects.toBe(error);
  });

  describe.each([undefined, true] as const)(
    "graph control flow (handleToolErrors: %s)",
    (handleToolErrors) => {
      it.each([
        new GraphBubbleUp("control"),
        new GraphDrained("shutdown"),
        new ParentCommand(
          new Command({ goto: "parent", graph: Command.PARENT })
        ),
        new GraphInterrupt([{ value: "approve" }]),
        new NodeInterrupt("approve"),
      ])(
        "preserves %s through passthrough, retry, and error middleware",
        async (error) => {
          const retryOn = vi.fn(() => true);
          const onFailure = vi.fn(() => "must not handle control flow");
          const onError = vi.fn(() => "must not handle control flow");
          for (const middleware of [
            passthrough(),
            toolRetryMiddleware({ retryOn, onFailure, maxRetries: 0 }),
            toolErrorMiddleware({ onError }),
          ]) {
            await expect(
              node(error, [middleware], { handleToolErrors }).invoke(input())
            ).rejects.toBe(error);
          }
          expect(retryOn).not.toHaveBeenCalled();
          expect(onFailure).not.toHaveBeenCalled();
          expect(onError).not.toHaveBeenCalled();
        }
      );
    }
  );

  describe.each(["retryOn", "onFailure", "onError"] as const)(
    "%s callback failures",
    (kind) => {
      it.each([
        [true, false],
        [true, true],
        [false, false],
        [false, true],
      ])(
        "preserves callback-origin fatality (same tool error: %s, whole agent: %s)",
        async (sameError, wholeAgent) => {
          const error = new Error("tool failed");
          const thrown = sameError ? error : new Error("callback failed");
          const callback = vi.fn((caught: unknown) => {
            expect(caught).toBe(error);
            throw thrown;
          });
          const middleware =
            kind === "onError"
              ? toolErrorMiddleware({ onError: callback })
              : toolRetryMiddleware({
                  maxRetries: 0,
                  initialDelayMs: 0,
                  retryOn: kind === "retryOn" ? callback : () => true,
                  onFailure: kind === "onFailure" ? callback : "continue",
                });
          const middlewareStack = [passthrough("outer"), middleware];
          const result = wholeAgent
            ? createAgent({
                model: new FakeToolCallingModel({
                  toolCalls: [[{ name: "boom", args: {}, id: "call_1" }], []],
                }),
                tools: [failingTool(error)],
                middleware: middlewareStack,
              }).invoke({ messages: [new HumanMessage("Use the tool")] })
            : node(error, middlewareStack).invoke(input());
          if (sameError) await expect(result).rejects.toBe(error);
          else await expect(result).rejects.toMatchObject({ cause: thrown });
          expect(callback).toHaveBeenCalledOnce();
        }
      );
    }
  );

  it("retains callback return semantics when no callback throws", async () => {
    const retryOn = vi.fn(() => false);
    const onFailure = vi.fn(() => "formatted retry failure");
    const onError = vi.fn(() => "formatted tool failure");
    const error = new Error("tool failed");
    const retryResult = await node(error, [
      toolRetryMiddleware({ retryOn, onFailure }),
    ]).invoke(input());
    const errorResult = await node(error, [
      toolErrorMiddleware({ onError }),
    ]).invoke(input());
    expect(retryResult.messages[0].content).toBe("formatted retry failure");
    expect(errorResult.messages[0].content).toBe("formatted tool failure");
    expect(retryOn).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });

  it.each(["outer", "inner", "both"])(
    "preserves retry predicate identity with %s retry middleware",
    async (position) => {
      const error = Object.freeze(new TypeError("retry"));
      const observed: unknown[] = [];
      const calls = vi.fn(() => {
        throw error;
      });
      const retry = (name: string) => ({
        ...toolRetryMiddleware({
          maxRetries: 1,
          initialDelayMs: 0,
          jitter: false,
          onFailure: "error",
          retryOn: (caught) => {
            observed.push(caught);
            return true;
          },
        }),
        name,
      });
      const middleware =
        position === "both"
          ? [retry("outer"), passthrough(), retry("inner")]
          : position === "outer"
            ? [retry("outer"), passthrough()]
            : [passthrough(), retry("inner")];
      const toolNode = new ToolNode(
        [
          tool(calls, {
            name: "boom",
            description: "Retries locally",
            schema: z.object({}),
          }),
        ],
        {
          wrapToolCall: wrapToolCall(middleware),
        }
      );
      await expect(toolNode.invoke(input())).rejects.toBe(error);
      expect(calls).toHaveBeenCalledTimes(position === "both" ? 4 : 2);
      expect(observed).toHaveLength(position === "both" ? 6 : 2);
      expect(observed.every((caught) => caught === error)).toBe(true);
    }
  );

  it("retains deliberate fatality for nonretryable tool validation errors", async () => {
    const strict = tool(async () => "ok", {
      name: "boom",
      description: "Requires text",
      schema: z.object({ text: z.string() }),
    });
    const retryOn = vi.fn(() => false);
    const toolNode = new ToolNode([strict], {
      wrapToolCall: wrapToolCall([
        passthrough(),
        toolRetryMiddleware({ retryOn, onFailure: "error", initialDelayMs: 0 }),
      ]),
    });
    await expect(toolNode.invoke(input())).rejects.toThrow(
      "did not match expected schema"
    );
    expect(retryOn).toHaveBeenCalledOnce();
  });

  it.each([new Error("shared"), "shared", undefined])(
    "does not retain an inner fatal mark after a later unmarked throw of the same value (%s)",
    async (error) => {
      const selected = failingTool(error);
      const excluded = failingTool(error, "other");
      const inner = createMiddleware({
        name: "selectedFatal",
        wrapToolCall: async (request, handler) => {
          try {
            return await handler(request);
          } catch (caught) {
            if (request.toolCall.name === "boom")
              markToolErrorAsFatal(request, caught);
            throw caught;
          }
        },
      });
      const retryOuter = createMiddleware({
        name: "retryOuter",
        wrapToolCall: async (request, handler) => {
          try {
            return await handler(request);
          } catch {
            return handler({
              ...request,
              tool: excluded,
              toolCall: { ...request.toolCall, name: "other" },
            });
          }
        },
      });
      const toolNode = new ToolNode([selected, excluded], {
        wrapToolCall: wrapToolCall([retryOuter, inner]),
      });
      expect((await toolNode.invoke(input())).messages[0].status).toBe("error");
    }
  );

  it("clears stale built-in retry fatality when an outer retry switches to an excluded tool", async () => {
    const error = new Error("shared");
    const excluded = failingTool(error, "other");
    const retryOuter = createMiddleware({
      name: "retryOuter",
      wrapToolCall: async (request, handler) => {
        try {
          return await handler(request);
        } catch {
          return handler({
            ...request,
            tool: excluded,
            toolCall: { ...request.toolCall, name: "other" },
          });
        }
      },
    });
    const toolNode = new ToolNode([failingTool(error), excluded], {
      wrapToolCall: wrapToolCall([
        retryOuter,
        toolRetryMiddleware({
          tools: ["boom"],
          maxRetries: 0,
          onFailure: "error",
        }),
      ]),
    });
    expect((await toolNode.invoke(input())).messages[0].status).toBe("error");
  });

  it.each(["success", "different error"])(
    "retains an earlier fatal value after a later %s",
    async (later) => {
      const error = new Error("first failure");
      const other = tool(
        async () => {
          if (later === "different error") throw new Error("later failure");
          return "ok";
        },
        { name: "other", description: "A later attempt", schema: z.object({}) }
      );
      const outer = createMiddleware({
        name: "outer",
        wrapToolCall: async (request, handler) => {
          try {
            return await handler(request);
          } catch (first) {
            try {
              await handler({
                ...request,
                tool: other,
                toolCall: { ...request.toolCall, name: "other" },
              });
            } catch {
              /* The caller chooses the earlier failure. */
            }
            throw first;
          }
        },
      });
      const toolNode = new ToolNode([failingTool(error), other], {
        wrapToolCall: wrapToolCall([
          outer,
          toolRetryMiddleware({
            tools: ["boom"],
            maxRetries: 0,
            onFailure: "error",
          }),
        ]),
      });
      await expect(toolNode.invoke(input())).rejects.toBe(error);
    }
  );

  it("does not count failed request merging as an active handler attempt", async () => {
    const error = new Error("shared");
    const mergeError = new Error("invalid state getter");
    const excluded = failingTool(error, "other");
    const caught: unknown[] = [];
    const outer = createMiddleware({
      name: "outer",
      wrapToolCall: async (request, handler) => {
        try {
          await handler({
            ...request,
            state: {
              get messages(): never {
                throw mergeError;
              },
            },
          });
        } catch (failure) {
          caught.push(failure);
        }
        try {
          return await handler(request);
        } catch (failure) {
          caught.push(failure);
          return handler({
            ...request,
            tool: excluded,
            toolCall: { ...request.toolCall, name: "other" },
          });
        }
      },
    });
    const toolNode = new ToolNode([failingTool(error), excluded], {
      wrapToolCall: wrapToolCall([
        outer,
        toolRetryMiddleware({
          tools: ["boom"],
          maxRetries: 0,
          onFailure: "error",
        }),
      ]),
    });
    expect((await toolNode.invoke(input())).messages[0].status).toBe("error");
    expect(caught).toEqual([mergeError, error]);
  });

  it("keeps a hook's own explicit mark when it retries the identical value", async () => {
    const error = new Error("shared");
    const retry = createMiddleware({
      name: "markThenRetry",
      wrapToolCall: async (request, handler) => {
        try {
          return await handler(request);
        } catch (caught) {
          markToolErrorAsFatal(request, caught);
          return handler(request);
        }
      },
    });
    await expect(node(error, [retry]).invoke(input())).rejects.toBe(error);
  });

  it.each([false, true])(
    "conservatively preserves fatality for overlapping identical-value attempts (reversed: %s)",
    async (reverse) => {
      const error = new Error("shared");
      const excluded = failingTool(error, "other");
      const parallel = createMiddleware({
        name: "parallel",
        wrapToolCall: async (request, handler) => {
          const other = {
            ...request,
            tool: excluded,
            toolCall: { ...request.toolCall, name: "other" },
          };
          await Promise.allSettled(
            (reverse ? [other, request] : [request, other]).map((r) =>
              handler(r)
            )
          );
          throw error;
        },
      });
      const toolNode = new ToolNode([failingTool(error), excluded], {
        wrapToolCall: wrapToolCall([
          parallel,
          toolRetryMiddleware({
            tools: ["boom"],
            maxRetries: 0,
            onFailure: "error",
          }),
        ]),
      });
      await expect(toolNode.invoke(input())).rejects.toBe(error);
    }
  );

  it("isolates provenance and fatality across concurrent tool calls sharing an Error", async () => {
    const error = new Error("shared");
    const toolNode = new ToolNode(
      [failingTool(error), failingTool(error, "other")],
      {
        wrapToolCall: wrapToolCall([
          toolRetryMiddleware({
            tools: ["boom"],
            maxRetries: 0,
            onFailure: "error",
          }),
        ]),
      }
    );
    const [fatalResult, ordinaryResult] = await Promise.allSettled([
      toolNode.invoke(input()),
      toolNode.invoke(input("other")),
    ]);
    expect(fatalResult).toMatchObject({ status: "rejected", reason: error });
    expect(ordinaryResult.status).toBe("fulfilled");
    if (ordinaryResult.status === "fulfilled")
      expect(ordinaryResult.value.messages[0].status).toBe("error");
    const middlewareError = createMiddleware({
      name: "origin",
      wrapToolCall: () => {
        throw error;
      },
    });
    await expect(
      node(error, [middlewareError]).invoke(input())
    ).rejects.toSatisfy((caught) => MiddlewareError.isInstance(caught));
  });

  it("retains end-to-end fatal retry behavior through nested middleware", async () => {
    const error = new Error("fatal retry");
    const agent = createAgent({
      model: new FakeToolCallingModel({
        toolCalls: [[{ name: "boom", args: {}, id: "call_1" }], []],
      }),
      tools: [failingTool(error)],
      middleware: [
        passthrough("outer"),
        toolRetryMiddleware({ maxRetries: 0, onFailure: "error" }),
        passthrough("inner"),
      ],
    });
    await expect(
      agent.invoke({ messages: [new HumanMessage("Use the tool")] })
    ).rejects.toBe(error);
  });
});
