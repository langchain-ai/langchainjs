import type {
  StructuredToolInterface,
  DynamicTool,
} from "@langchain/core/tools";
import type { RunnableToolLike } from "@langchain/core/runnables";

export type ServerTool = Record<string, unknown>;
export type ClientTool =
  | StructuredToolInterface
  | DynamicTool
  | RunnableToolLike;
