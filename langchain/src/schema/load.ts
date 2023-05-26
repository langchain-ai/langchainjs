export interface SerializedFields {
  [key: string]: unknown;
}

export interface Serialized {
  v: number;
  type: "constructor" | "function";
  identifier: string[];
  arguments: unknown[];
  fields?: SerializedFields;
}

export abstract class Serializable {
  abstract lc_namespace: string[];

  abstract lc_name: string;

  lc_arguments: unknown[];

  lc_fields?: string[];

  constructor(...args: unknown[]) {
    this.lc_arguments = args;
  }

  toJSON(): Serialized {
    return {
      v: 1,
      type: "constructor",
      identifier: [...this.lc_namespace, this.lc_name, this.constructor.name],
      arguments: this.lc_arguments,
      fields: this.lc_fields?.reduce((acc, key) => {
        acc[key] = this[key as keyof this];
        return acc;
      }, {} as SerializedFields),
    };
  }
}
