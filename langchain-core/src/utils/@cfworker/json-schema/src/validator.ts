import { dereference } from "./dereference.js";
import { Schema, SchemaDraft } from "./types.js";
import { validate } from "./validate.js";

export class Validator {
  private readonly lookup: ReturnType<typeof dereference>;

  constructor(
    private readonly schema: Schema | boolean,
    private readonly draft: SchemaDraft = "2019-09",
    private readonly shortCircuit = true
  ) {
    this.lookup = dereference(schema);
  }

  public validate(instance: any) {
    return validate(
      instance,
      this.schema,
      this.draft,
      this.lookup,
      this.shortCircuit
    );
  }

  public addSchema(schema: Schema, id?: string) {
    if (id) {
      schema = { ...schema, $id: id };
    }
    dereference(schema, this.lookup);
  }
}
