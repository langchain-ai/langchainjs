import { type SerializedFields, keyToJson, mapKeys } from "./map_keys.js";

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

/**
 * Get a unique name for the module, rather than parent class implementations.
 * Should not be subclassed, subclass lc_name above instead.
 */
export function get_lc_unique_name(
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  serializableClass: typeof Serializable
): string {
  // "super" here would refer to the parent class of Serializable,
  // when we want the parent class of the module actually calling this method.
  const parentClass = Object.getPrototypeOf(serializableClass);
  const lcNameIsSubclassed =
    typeof serializableClass.lc_name === "function" &&
    (typeof parentClass.lc_name !== "function" ||
      serializableClass.lc_name() !== parentClass.lc_name());
  if (lcNameIsSubclassed) {
    return serializableClass.lc_name();
  } else {
    return serializableClass.name;
  }
}

export abstract class Serializable {
  lc_serializable = false;

  lc_kwargs: SerializedFields;

  /**
   * A path to the module that contains the class, eg. ["langchain", "llms"]
   * Usually should be the same as the entrypoint the class is exported from.
   */
  abstract lc_namespace: string[];

  /**
   * The name of the serializable. Override to provide an alias or
   * to preserve the serialized module name in minified environments.
   *
   * Implemented as a static method to support loading logic.
   */
  static lc_name(): string {
    return this.name;
  }

  /**
   * The final serialized identifier for the module.
   */
  get lc_id(): string[] {
    return [
      ...this.lc_namespace,
      get_lc_unique_name(this.constructor as typeof Serializable),
    ];
  }

  /**
   * A map of secrets, which will be omitted from serialization.
   * Keys are paths to the secret in constructor args, e.g. "foo.bar.baz".
   * Values are the secret ids, which will be used when deserializing.
   */
  get lc_secrets(): { [key: string]: string } | undefined {
    return undefined;
  }

  /**
   * A map of additional attributes to merge with constructor args.
   * Keys are the attribute names, e.g. "foo".
   * Values are the attribute values, which will be serialized.
   * These attributes need to be accepted by the constructor as arguments.
   */
  get lc_attributes(): SerializedFields | undefined {
    return undefined;
  }

  /**
   * A map of aliases for constructor args.
   * Keys are the attribute names, e.g. "foo".
   * Values are the alias that will replace the key in serialization.
   * This is used to eg. make argument names match Python.
   */
  get lc_aliases(): { [key: string]: string } | undefined {
    return undefined;
  }

  constructor(kwargs?: SerializedFields, ..._args: never[]) {
    this.lc_kwargs = kwargs || {};
  }

  toJSON(): Serialized {
    if (!this.lc_serializable) {
      return this.toJSONNotImplemented();
    }
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

    const aliases: { [key: string]: string } = {};
    const secrets: { [key: string]: string } = {};
    const kwargs = Object.keys(this.lc_kwargs).reduce((acc, key) => {
      acc[key] = key in this ? this[key as keyof this] : this.lc_kwargs[key];
      return acc;
    }, {} as SerializedFields);
    // get secrets, attributes and aliases from all superclasses
    for (
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      let current = Object.getPrototypeOf(this);
      current;
      current = Object.getPrototypeOf(current)
    ) {
      Object.assign(aliases, Reflect.get(current, "lc_aliases", this));
      Object.assign(secrets, Reflect.get(current, "lc_secrets", this));
      Object.assign(kwargs, Reflect.get(current, "lc_attributes", this));
    }

    // include all secrets used, even if not in kwargs,
    // will be replaced with sentinel value in replaceSecrets
    Object.keys(secrets).forEach((keyPath) => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias, @typescript-eslint/no-explicit-any
      let read: any = this;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let write: any = kwargs;

      const [last, ...partsReverse] = keyPath.split(".").reverse();
      for (const key of partsReverse.reverse()) {
        if (!(key in read) || read[key] === undefined) return;
        if (!(key in write) || write[key] === undefined) {
          if (typeof read[key] === "object" && read[key] != null) {
            write[key] = {};
          } else if (Array.isArray(read[key])) {
            write[key] = [];
          }
        }

        read = read[key];
        write = write[key];
      }

      if (last in read && read[last] !== undefined) {
        write[last] = write[last] || read[last];
      }
    });

    return {
      lc: 1,
      type: "constructor",
      id: this.lc_id,
      kwargs: mapKeys(
        Object.keys(secrets).length ? replaceSecrets(kwargs, secrets) : kwargs,
        keyToJson,
        aliases
      ),
    };
  }

  toJSONNotImplemented(): SerializedNotImplemented {
    return {
      lc: 1,
      type: "not_implemented",
      id: this.lc_id,
    };
  }
}
