import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
// Test with direct "zod" import (how users typically import it)
import { z as zodMain } from "zod";
import { tool } from "@langchain/core/tools";
import type { BaseStore } from "@langchain/langgraph";

import { createAgent, createMiddleware } from "../index.js";
import type { Runtime, WithMaybeContext } from "../runtime.js";
import type { InferAgentContext } from "../types.js";

describe("WithMaybeContext", () => {
  it("should work with string prompt (zod/v3)", async () => {
    const contextSchema = z.object({
      foobar: z.object({
        baz: z.string(),
      }),
    });

    // eslint-disable-next-line no-void
    void createAgent({
      model: "openai:gpt-4",
      contextSchema,
      tools: [],
    });
  });

  it("should work with nested objects and records (zod/v4)", async () => {
    const contextSchema = z4.object({
      citationTracking: z4.object({
        citationIdToDocumentId: z4.record(z4.number(), z4.string()),
        documentIdToCitationId: z4.record(z4.string(), z4.number().optional()),
        nextCitationId: z4.number(),
      }),
    });

    // eslint-disable-next-line no-void
    void createAgent({
      model: "openai:gpt-4",
      contextSchema,
      tools: [],
    });
  });

  it("should work with direct zod import", async () => {
    const contextSchema = zodMain.object({
      citationTracking: zodMain.object({
        citationIdToDocumentId: zodMain.record(
          zodMain.number(),
          zodMain.string()
        ),
        documentIdToCitationId: zodMain.record(
          zodMain.string(),
          zodMain.number().optional()
        ),
        nextCitationId: zodMain.number(),
      }),
    });

    // eslint-disable-next-line no-void
    void createAgent({
      model: "openai:gpt-4",
      contextSchema,
      tools: [],
    });
  });

  it("should provide runtime type", () => {
    const contextSchema = z.object({
      userId: z.string(),
    });

    tool(
      async (_, runtime: Partial<Runtime<z.infer<typeof contextSchema>>>) => {
        expectTypeOf(runtime.context).toEqualTypeOf<
          z.infer<typeof contextSchema> | undefined
        >();
        expectTypeOf(runtime.configurable?.thread_id).toEqualTypeOf<
          string | undefined
        >();
        expectTypeOf(runtime.store).toEqualTypeOf<BaseStore | undefined>();
        expectTypeOf(runtime.writer).toEqualTypeOf<
          ((chunk: unknown) => void) | undefined
        >();
        expectTypeOf(runtime.signal).toEqualTypeOf<AbortSignal | undefined>();
      },
      {
        name: "test",
        description: "test",
        schema: z.object({}),
      }
    );
  });

  it("should detect context as optional if it has defaults", () => {
    const contextSchema = z
      .object({
        customDefaultContextProp: z.string().default("default value"),
        customOptionalContextProp: z.string().optional(),
        customRequiredContextProp: z.string(),
      })
      .default({
        customRequiredContextProp: "default value",
      });

    const a: WithMaybeContext<typeof contextSchema> = {};
    console.log(a);
  });

  it("should properly infer context from agent type", () => {
    const contextSchema = z.object({
      foobar: z.object({
        baz: z.string(),
      }),
    });
    const middleware = createMiddleware({
      name: "middleware",
      contextSchema: z.object({
        middlewareContext: z.number(),
      }),
    });
    const agent = createAgent({
      model: "openai:gpt-4",
      contextSchema,
      middleware: [middleware],
      tools: [],
    });
    type AgentContext = InferAgentContext<typeof agent>;
    expectTypeOf<AgentContext>().toMatchObjectType<{
      foobar: {
        baz: string;
      };
      middlewareContext: number;
    }>();
  });
});
