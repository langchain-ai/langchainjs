export interface SerializedFields {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface BaseSerialized<T extends string> {
  lc: number;
  type: T;
  id: string[];
}

export interface SerializedConstructor extends BaseSerialized<"constructor"> {
  kwargs: SerializedFields;
  fields?: SerializedFields;
}

export interface SerializedSecret extends BaseSerialized<"secret"> {}

export interface SerializedNotImplemented
  extends BaseSerialized<"not_implemented"> {}

export type Serialized =
  | SerializedConstructor
  | SerializedSecret
  | SerializedNotImplemented;

function shallowCopy<T extends object>(obj: T): T {
  return Array.isArray(obj) ? ([...obj] as T) : ({ ...obj } as T);
}

function replaceSecrets(
  root: SerializedFields,
  secretsMap: { [key: string]: string }
): SerializedFields {
  const result = shallowCopy(root);
  for (const [path, secretId] of Object.entries(secretsMap)) {
    const [last, ...partsReverse] = path.split(".").reverse();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = result;
    for (const part of partsReverse.reverse()) {
      if (current[part] === undefined) {
        break;
      }
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

  lc_kwargs: SerializedFields;

  get lc_secrets(): { [key: string]: string } | undefined {
    return undefined;
  }

  lc_fields?: string[];

  constructor(kwargs?: SerializedFields, ..._args: never[]) {
    this.lc_kwargs = kwargs || {};
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
      kwargs: this.lc_secrets
        ? replaceSecrets(this.lc_kwargs, secrets)
        : this.lc_kwargs,
      fields: this.lc_fields?.reduce((acc, key) => {
        acc[key] = this[key as keyof this];
        return acc;
      }, {} as SerializedFields),
    };
  }

  toJSONNotImplemented(): SerializedNotImplemented {
    return {
      lc: 1,
      type: "not_implemented",
      id: [...this.lc_namespace, this.constructor.name],
    };
  }
}
