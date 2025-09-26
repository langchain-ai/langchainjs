import { z } from "zod/v3";
import {
  InferInteropZodInput,
  InteropZodObject,
} from "@langchain/core/utils/types";
import { tool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";

import { createMiddleware } from "../middleware.js";
import type { AgentBuiltInState, Runtime } from "../types.js";
import type { ClientTool, ServerTool } from "../../types.js";

const contextSchema = z.object({
  name: z.string(),
  description: z.string(),
  schema: z.custom<InteropZodObject>(),
  workflow: z.record(
    z.string(),
    z.union([
      z.string(),
      z
        .function()
        .args(
          z.custom<AgentBuiltInState>(),
          z.custom<Runtime<AgentBuiltInState, unknown>>()
        ),
    ])
  ),
  tools: z.array(z.custom<ClientTool | ServerTool>()).default([]),
  summarizeWorkflowHistory: z.boolean().default(false),
  start: z.string(),
});
type ToolSequenceMiddlewareOptions = InferInteropZodInput<typeof contextSchema>;

export function toolSequenceMiddleware(options: ToolSequenceMiddlewareOptions) {
  const allTasks = Object.keys(options.workflow);
  const ad = tool(() => {}, {
    name: options.name,
    description: options.description,
    schema: options.schema as unknown as z.AnyZodObject,
  });

  return createMiddleware({
    name: "toolSequenceMiddleware",
    tools: [ad, ...(options.tools || [])],
    modifyModelRequest: async (request, state, runtime) => {
      const lastMessage = state.messages.at(-1);

      /**
       * check if sequence is triggered
       */
      if (
        ToolMessage.isInstance(lastMessage) &&
        lastMessage.name === options.name
      ) {
        return {
          ...request,
          toolChoice: { type: "function", function: { name: options.start } },
        };
      }

      /**
       * go to next step in sequence
       */
      if (
        ToolMessage.isInstance(lastMessage) &&
        lastMessage.name &&
        allTasks.includes(lastMessage.name)
      ) {
        return {
          ...request,
          toolChoice: {
            type: "function",
            function: { name: options.workflow[lastMessage.name] as string },
          },
        };
      }

      /**
       * otherwise just finish
       */
      return {
        ...request,
        // toolChoice: { type: "function", function: { name: options.start } },
      };
    },
  });
}
