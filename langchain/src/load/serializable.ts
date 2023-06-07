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

  get lc_attributes(): SerializedFields | undefined {
    return undefined;
  }

  constructor(kwargs?: SerializedFields, ..._args: never[]) {
    this.lc_kwargs = kwargs || {};
  }

  toJSON(): Serialized {
    const secrets: { [key: string]: string } = {};

    if (
      // eslint-disable-next-line no-instanceof/no-instanceof
      this.lc_kwargs instanceof Serializable ||
      typeof this.lc_kwargs !== "object" ||
      Array.isArray(this.lc_kwargs)
    ) {
      // We do not support serialization of classes with arg not a POJO
      // I'm aware the check above isn't as strict as it could be
      return this.toJSONNotImplemented();
    }

    const kwargs = { ...this.lc_kwargs };
    // get secrets and attributes from all superclasses
    for (
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      let current = Object.getPrototypeOf(this);
      current;
      current = Object.getPrototypeOf(current)
    ) {
      Object.assign(secrets, Reflect.get(current, "lc_secrets", this));
      Object.assign(kwargs, Reflect.get(current, "lc_attributes", this));
    }

    return {
      lc: 1,
      type: "constructor",
      id: [...this.lc_namespace, this.constructor.name],
      kwargs: this.lc_secrets ? replaceSecrets(kwargs, secrets) : kwargs,
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
