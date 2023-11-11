import { z } from "zod";
import { CallbackManagerForToolRun } from "../callbacks/manager.js";
import { StructuredTool, Tool, ToolParams } from "./base.js";

export interface BaseDynamicToolInput extends ToolParams {
  name: string;
  description: string;
  returnDirect?: boolean;
}

/**
 * Interface for the input parameters of the DynamicTool class.
 */
export interface DynamicToolInput extends BaseDynamicToolInput {
  func: (
    input: string,
    runManager?: CallbackManagerForToolRun
  ) => Promise<string>;
}

/**
 * Interface for the input parameters of the DynamicStructuredTool class.
 */
export interface DynamicStructuredToolInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends BaseDynamicToolInput {
  func: (
    input: z.infer<T>,
    runManager?: CallbackManagerForToolRun
  ) => Promise<string>;
  schema: T;
}

/**
 * A tool that can be created dynamically from a function, name, and description.
 */
export class DynamicTool extends Tool {
  static lc_name() {
    return "DynamicTool";
  }

  name: string;

  description: string;

  func: DynamicToolInput["func"];

  constructor(fields: DynamicToolInput) {
    super(fields);
    this.name = fields.name;
    this.description = fields.description;
    this.func = fields.func;
    this.returnDirect = fields.returnDirect ?? this.returnDirect;
  }

  /** @ignore */
  async _call(
    input: string,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return this.func(input, runManager);
  }
}

/**
 * A tool that can be created dynamically from a function, name, and
 * description, designed to work with structured data. It extends the
 * StructuredTool class and overrides the _call method to execute the
 * provided function when the tool is called.
 */
export class DynamicStructuredTool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends StructuredTool {
  static lc_name() {
    return "DynamicStructuredTool";
  }

  name: string;

  description: string;

  func: DynamicStructuredToolInput["func"];

  schema: T;

  constructor(fields: DynamicStructuredToolInput<T>) {
    super(fields);
    this.name = fields.name;
    this.description = fields.description;
    this.func = fields.func;
    this.returnDirect = fields.returnDirect ?? this.returnDirect;
    this.schema = fields.schema;
  }

  protected _call(
    arg: z.output<T>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return this.func(arg, runManager);
  }
}
