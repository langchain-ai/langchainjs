/**
 * TypeScript type definitions for Deep Agents
 *
 * This file contains all the TypeScript interfaces and types that correspond
 * to the Python TypedDict and other type definitions. Defines all necessary
 * TypeScript interfaces and types including StateSchemaType, SubAgent, Todo,
 * and proper generic types for state schemas.
 */
import { z } from "zod/v3";
import type { AgentMiddleware } from "@langchain/core/middleware";
import type { HumanInTheLoopMiddlewareConfig } from "../middleware/hitl.js";
import type { StructuredTool } from "@langchain/core/tools";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type {
  InferInteropZodInput,
  InteropZodObject,
} from "@langchain/core/utils/types";

/**
 * SubAgent interface matching Python's TypedDict structure
 */
export const SubAgentSchema = z.object({
  name: z.string(),
  description: z.string(),
  prompt: z.string(),
  tools: z.array(z.string()).optional(),
  // Optional per-subagent model: can be either a model instance or a record of model name to model instance
  model: z.union([z.custom<LanguageModelLike>(), z.string()]).optional(),
  middleware: z.array(z.custom<AgentMiddleware>()).optional(),
});
export type SubAgent = InferInteropZodInput<typeof SubAgentSchema>;

export interface CreateDeepAgentParams {
  tools?: StructuredTool[];
  instructions?: string;
  model?: LanguageModelLike | string;
  subagents?: SubAgent[];
  interruptConfig?: NonNullable<HumanInTheLoopMiddlewareConfig>["interruptOn"];
  builtinTools?: string[];
}

export interface CreateTaskToolParams<StateSchema extends InteropZodObject> {
  subagents: SubAgent[];
  tools?: Record<string, StructuredTool>;
  model?: LanguageModelLike;
  stateSchema?: StateSchema;
}
