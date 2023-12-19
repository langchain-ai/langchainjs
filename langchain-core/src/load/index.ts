import {
  Serializable,
  SerializedConstructor,
  SerializedNotImplemented,
  SerializedSecret,
  get_lc_unique_name,
} from "./serializable.js";
import { optionalImportEntrypoints as defaultOptionalImportEntrypoints } from "./import_constants.js";
import * as coreImportMap from "./import_map.js";
import type { OptionalImportMap, SecretMap } from "./import_type.js";
import { type SerializedFields, keyFromJson, mapKeys } from "./map_keys.js";
import { getEnvironmentVariable } from "../utils/env.js";

function combineAliasesAndInvert(constructor: typeof Serializable) {
  const aliases: { [key: string]: string } = {};
  for (
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current = constructor;
    current && current.prototype;
    current = Object.getPrototypeOf(current)
  ) {
    Object.assign(aliases, Reflect.get(current.prototype, "lc_aliases"));
  }
  return Object.entries(aliases).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {} as Record<string, string>);
}

async function reviver(
  this: {
    optionalImportsMap: OptionalImportMap;
    optionalImportEntrypoints: string[];
    secretsMap: SecretMap;
    importMap: Record<string, unknown>;
    path?: string[];
  },
  value: unknown
): Promise<unknown> {
  const {
    optionalImportsMap,
    optionalImportEntrypoints,
    importMap,
    secretsMap,
    path = ["$"],
  } = this;
  const pathStr = path.join(".");
  if (
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
      const secretValueInEnv = getEnvironmentVariable(key);
      if (secretValueInEnv) {
        return secretValueInEnv;
      } else {
        throw new Error(
          `Missing key "${key}" for ${pathStr} in load(secretsMap={})`
        );
      }
    }
  } else if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "lc" in value &&
    "type" in value &&
    "id" in value &&
    value.lc === 1 &&
    value.type === "not_implemented"
  ) {
    const serialized = value as SerializedNotImplemented;
    const str = JSON.stringify(serialized);
    throw new Error(
      `Trying to load an object that doesn't implement serialization: ${pathStr} -> ${str}`
    );
  } else if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "lc" in value &&
    "type" in value &&
    "id" in value &&
    "kwargs" in value &&
    value.lc === 1
  ) {
    const serialized = value as SerializedConstructor;
    const str = JSON.stringify(serialized);
    const [name, ...namespaceReverse] = serialized.id.slice().reverse();
    const namespace = namespaceReverse.reverse();
    const importMaps = { langchain_core: coreImportMap, langchain: importMap };

    let module:
      | (typeof importMaps)["langchain_core"][keyof (typeof importMaps)["langchain_core"]]
      | (typeof importMaps)["langchain"][keyof (typeof importMaps)["langchain"]]
      | OptionalImportMap[keyof OptionalImportMap]
      | null = null;

    const optionalImportNamespaceAliases = [namespace.join("/")];
    if (namespace[0] === "langchain_community") {
      optionalImportNamespaceAliases.push(
        ["langchain", ...namespace.slice(1)].join("/")
      );
    }
    const matchingNamespaceAlias = optionalImportNamespaceAliases.find(
      (alias) => alias in optionalImportsMap
    );
    if (
      defaultOptionalImportEntrypoints
        .concat(optionalImportEntrypoints)
        .includes(namespace.join("/")) ||
      matchingNamespaceAlias
    ) {
      if (matchingNamespaceAlias !== undefined) {
        module = await optionalImportsMap[
          matchingNamespaceAlias as keyof typeof optionalImportsMap
        ];
      } else {
        throw new Error(
          `Missing key "${namespace.join(
            "/"
          )}" for ${pathStr} in load(optionalImportsMap={})`
        );
      }
    } else {
      let finalImportMap:
        | (typeof importMaps)["langchain"]
        | (typeof importMaps)["langchain_core"];
      // Currently, we only support langchain and langchain_core imports.
      if (namespace[0] === "langchain" || namespace[0] === "langchain_core") {
        finalImportMap = importMaps[namespace[0]];
        namespace.shift();
      } else {
        throw new Error(`Invalid namespace: ${pathStr} -> ${str}`);
      }

      // The root namespace "langchain" is not a valid import.
      if (namespace.length === 0) {
        throw new Error(`Invalid namespace: ${pathStr} -> ${str}`);
      }

      // Find the longest matching namespace.
      let importMapKey: string;
      do {
        importMapKey = namespace.join("__");
        if (importMapKey in finalImportMap) {
          break;
        } else {
          namespace.pop();
        }
      } while (namespace.length > 0);

      // If no matching namespace is found, throw an error.
      if (importMapKey in finalImportMap) {
        module = finalImportMap[importMapKey as keyof typeof finalImportMap];
      }
    }

    if (typeof module !== "object" || module === null) {
      throw new Error(`Invalid namespace: ${pathStr} -> ${str}`);
    }

    // Extract the builder from the import map.
    const builder =
      // look for a named export with the same name as the class
      module[name as keyof typeof module] ??
      // look for an export with a lc_name property matching the class name
      // this is necessary for classes that are minified
      Object.values(module).find(
        (v) =>
          typeof v === "function" &&
          get_lc_unique_name(v as typeof Serializable) === name
      );
    if (typeof builder !== "function") {
      throw new Error(`Invalid identifer: ${pathStr} -> ${str}`);
    }

    // Recurse on the arguments, which may be serialized objects themselves
    const kwargs = await reviver.call(
      { ...this, path: [...path, "kwargs"] },
      serialized.kwargs
    );

    // Construct the object
    if (serialized.type === "constructor") {
      // eslint-disable-next-line new-cap, @typescript-eslint/no-explicit-any
      const instance = new (builder as any)(
        mapKeys(
          kwargs as SerializedFields,
          keyFromJson,
          combineAliasesAndInvert(builder)
        )
      );

      // Minification in severless/edge runtimes will mange the
      // name of classes presented in traces. As the names in import map
      // are present as-is even with minification, use these names instead
      Object.defineProperty(instance.constructor, "name", { value: name });

      return instance;
    } else {
      throw new Error(`Invalid type: ${pathStr} -> ${str}`);
    }
  } else if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return Promise.all(
        value.map((v, i) =>
          reviver.call({ ...this, path: [...path, `${i}`] }, v)
        )
      );
    } else {
      return Object.fromEntries(
        await Promise.all(
          Object.entries(value).map(async ([key, value]) => [
            key,
            await reviver.call({ ...this, path: [...path, key] }, value),
          ])
        )
      );
    }
  }
  return value;
}

export async function load<T>(
  text: string,
  {
    secretsMap,
    importMap,
    optionalImportsMap,
    optionalImportEntrypoints,
  }: {
    secretsMap: SecretMap;
    optionalImportsMap: OptionalImportMap;
    optionalImportEntrypoints: string[];
    importMap: Record<string, unknown>;
  }
): Promise<T> {
  const json = JSON.parse(text);
  return reviver.call(
    { secretsMap, optionalImportsMap, optionalImportEntrypoints, importMap },
    json
  ) as Promise<T>;
}
