import {
  SerializedConstructor,
  SerializedFunction,
  SerializedSecret,
} from "../schema/load.js";
import { optionalImportEntrypoints } from "./import_constants.js";
import * as importMap from "./import_map.js";
import { OptionalImportMap, SecretMap } from "./import_type.js";

async function reviver(
  this: {
    optionalImportsMap: OptionalImportMap;
    secretsMap: SecretMap;
  },
  value: unknown
): Promise<unknown> {
  const { optionalImportsMap, secretsMap } = this;
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "lc" in value &&
    "type" in value &&
    "id" in value &&
    "arguments" in value &&
    value.lc === 1
  ) {
    const serialized = value as SerializedConstructor | SerializedFunction;
    const str = JSON.stringify(serialized);
    const [name, ...namespaceReverse] = serialized.id.slice().reverse();
    const namespace = namespaceReverse.reverse();

    let module:
      | (typeof importMap)[keyof typeof importMap]
      | OptionalImportMap[keyof OptionalImportMap];
    if (
      optionalImportEntrypoints.includes(namespace.join("/")) ||
      namespace.join("/") in optionalImportsMap
    ) {
      if (namespace.join("/") in optionalImportsMap) {
        module = await optionalImportsMap[
          namespace.join("/") as keyof typeof optionalImportsMap
        ];
      } else {
        throw new Error(
          `Missing key "${namespace.join("/")}" in load(optionalImportsMap={})`
        );
      }
    } else {
      // Currently, we only support langchain imports.
      if (namespace[0] === "langchain") {
        namespace.shift();
      } else {
        throw new Error(`Invalid namespace: ${str}`);
      }

      // The root namespace "langchain" is not a valid import.
      if (namespace.length === 0) {
        throw new Error(`Invalid namespace: ${str}`);
      }

      // Find the longest matching namespace.
      let importMapKey: string;
      do {
        importMapKey = namespace.join("__");
        if (importMapKey in importMap) {
          break;
        } else {
          namespace.pop();
        }
      } while (namespace.length > 0);

      // If no matching namespace is found, throw an error.
      if (importMapKey in importMap) {
        module = importMap[importMapKey as keyof typeof importMap];
      }
    }

    if (typeof module !== "object" || module === null) {
      throw new Error(`Invalid namespace: ${str}`);
    }

    // Extract the builder from the import map.
    const builder = module[name as keyof typeof module];
    if (typeof builder !== "function") {
      throw new Error(`Invalid identifer: ${str}`);
    }

    // Recurse on the arguments, which may be serialized objects themselves
    const args = await Promise.all(serialized.arguments.map(reviver, this));

    // Construct the object
    if (serialized.type === "constructor") {
      // eslint-disable-next-line new-cap, @typescript-eslint/no-explicit-any
      const instance = new (builder as any)(...args);
      const fields = serialized.fields
        ? await reviver.call(this, serialized.fields)
        : undefined;
      Object.assign(instance, fields);
      return instance;
    } else if (serialized.type === "function") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (builder as any)(...args);
    } else {
      throw new Error(`Invalid type: ${str}`);
    }
  } else if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "lc" in value &&
    "type" in value &&
    "id" in value &&
    value.lc === 1 &&
    value.type === "secret"
  ) {
    const serialized = value as SerializedSecret;
    const [key] = serialized.id;
    if (key in secretsMap) {
      return secretsMap[key as keyof SecretMap];
    } else {
      throw new Error(`Missing key "${key}" in load(secretsMap={})`);
    }
  } else if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return Promise.all(value.map(reviver, this));
    } else {
      return Object.fromEntries(
        await Promise.all(
          Object.entries(value).map(async ([key, value]) => [
            key,
            await reviver.call(this, value),
          ])
        )
      );
    }
  }
  return value;
}

export async function load<T>(
  text: string,
  secretsMap: SecretMap = {},
  optionalImportsMap: OptionalImportMap = {}
): Promise<T> {
  const json = JSON.parse(text);
  return reviver.call({ secretsMap, optionalImportsMap }, json) as Promise<T>;
}
