import { CallbackManagerForToolRun } from "../../callbacks/manager.js";
import { StructuredTool, ToolParams } from "../../tools/index.js";
import { ToolInputSchemaOutputType } from "../../tools/types.js";
import { InteropZodObject } from "../types/zod.js";

export interface FakeToolParams<T extends InteropZodObject = InteropZodObject>
  extends ToolParams {
  name: string;
  description: string;
  schema: T;
}

export class FakeTool<
  T extends InteropZodObject = InteropZodObject,
> extends StructuredTool<T> {
  name: string;

  description: string;

  schema: T;

  constructor(fields: FakeToolParams<T>) {
    super(fields);
    this.name = fields.name;
    this.description = fields.description;
    this.schema = fields.schema;
  }

  protected async _call(
    arg: ToolInputSchemaOutputType<T>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return JSON.stringify(arg);
  }
}
