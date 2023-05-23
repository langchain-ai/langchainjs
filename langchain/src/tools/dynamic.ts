import { z } from "zod";
import { CallbackManagerForToolRun, Callbacks } from "../callbacks/manager.js";
import { StructuredTool, Tool } from "./base.js";

export interface BaseDynamicToolInput {
  name: string;
  description: string;
  returnDirect?: boolean;
  verbose?: boolean;
  callbacks?: Callbacks;
}

export interface DynamicToolInput extends BaseDynamicToolInput {
  func: (
    input: string,
    runManager?: CallbackManagerForToolRun
  ) => Promise<string>;
}

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
  name: string;

  description: string;

  func: DynamicToolInput["func"];

  constructor(fields: DynamicToolInput) {
    super(fields.verbose, fields.callbacks);
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

export class DynamicStructuredTool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends StructuredTool {
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
