export interface SerializedFields {
  [key: string]: unknown;
}

export interface BaseSerialized<T extends string> {
  lc: number;
  type: T;
  id: string[];
}

export interface SerializedConstructor extends BaseSerialized<"constructor"> {
  arguments: unknown[];
  fields?: SerializedFields;
}

export interface SerializedFunction extends BaseSerialized<"function"> {
  arguments: unknown[];
}

export interface SerializedSecret extends BaseSerialized<"secret"> {}

export type Serialized =
  | SerializedConstructor
  | SerializedFunction
  | SerializedSecret;

function shallowCopy<T extends object>(obj: T): T {
  return Array.isArray(obj) ? ([...obj] as T) : ({ ...obj } as T);
}

function replaceSecrets(
  root: unknown[],
  secretsMap: { [key: string]: string }
): unknown[] {
  const result = shallowCopy(root);
  for (const [path, secretId] of Object.entries(secretsMap)) {
    const [last, ...partsReverse] = path.split(".").reverse();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = result;
    for (const part of partsReverse.reverse()) {
      current[part] = shallowCopy(current[part]);
      current = current[part];
    }
    if (current[last] !== undefined) {
      current[last] = {
        lc: 1,
        type: "secret",
        id: [secretId],
      };
    }
  }
  return result;
}

export abstract class Serializable {
  abstract lc_namespace: string[];

  lc_arguments: unknown[];

  get lc_secrets(): { [key: string]: string } | undefined {
    return undefined;
  }

  lc_fields?: string[];

  constructor(...args: unknown[]) {
    this.lc_arguments = args;
  }

  toJSON(): Serialized {
    // get secrets from all superclasses
    const secrets: { [key: string]: string } = {};
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current = this;
    while (current) {
      Object.assign(secrets, current.lc_secrets);
      current = Object.getPrototypeOf(current);
    }

    return {
      lc: 1,
      type: "constructor",
      id: [...this.lc_namespace, this.constructor.name],
      arguments: this.lc_secrets
        ? replaceSecrets(this.lc_arguments, secrets)
        : this.lc_arguments,
      fields: this.lc_fields?.reduce((acc, key) => {
        acc[key] = this[key as keyof this];
        return acc;
      }, {} as SerializedFields),
    };
  }
}
