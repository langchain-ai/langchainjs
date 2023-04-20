import { StructuredTool } from "../../tools/base.js";

export type ObjectTool = StructuredTool;

export const FINISH_NAME = "finish";

export interface AutoGPTAction {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
}
