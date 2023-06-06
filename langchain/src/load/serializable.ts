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

  lc_attributes?: string[];

  constructor(kwargs?: SerializedFields, ..._args: never[]) {
    this.lc_kwargs = kwargs || {};
  }

  toJSON(): Serialized {
    const secrets: { [key: string]: string } = {};
    const kwargs = this.lc_kwargs;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current = this;
    // get secrets and attributes from all superclasses
    while (current) {
      Object.assign(secrets, current.lc_secrets);
      Object.assign(
        kwargs,
        // eslint-disable-next-line no-loop-func
        current.lc_attributes?.reduce((attrs, key) => {
          // eslint-disable-next-line no-param-reassign
          attrs[key] = current[key as keyof Serializable];
          return attrs;
        }, {} as SerializedFields)
      );
      current = Object.getPrototypeOf(current);
    }

    return {
      lc: 1,
      type: "constructor",
      id: [...this.lc_namespace, this.constructor.name],
      kwargs: this.lc_secrets
        ? replaceSecrets(this.lc_kwargs, secrets)
        : this.lc_kwargs,
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
