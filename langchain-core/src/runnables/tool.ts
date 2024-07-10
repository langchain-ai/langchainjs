import { ZodAny } from "../types/zod.js";
import { RunnableLambda } from "./base.js";
import { RunnableConfig } from "./config.js";

export interface RunnableToolLikeFields<RunInput, RunOutput> {
  name?: string;

  description?: string;

  schema: RunInput;

  func:
    | ((input: RunInput, config?: RunnableConfig) => RunOutput)
    | ((input: RunInput, config?: RunnableConfig) => Promise<RunOutput>);
}

export class RunnableToolLike<
  RunInput extends ZodAny,
  RunOutput = string
> extends RunnableLambda<RunInput, RunOutput> {
  description?: string;

  schema: RunInput;

  constructor(fields: RunnableToolLikeFields<RunInput, RunOutput>) {
    super({
      func: fields.func,
    });

    this.name = fields.name;
    this.description = fields.description;
    this.schema = fields.schema;
  }
}
