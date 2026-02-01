/**
 * Load LangChain objects from JSON strings or objects.
 *
 * ## How it works
 *
 * Each `Serializable` LangChain object has a unique identifier (its "class path"),
 * which is a list of strings representing the module path and class name. For example:
 *
 * - `AIMessage` -> `["langchain_core", "messages", "ai", "AIMessage"]`
 * - `ChatPromptTemplate` -> `["langchain_core", "prompts", "chat", "ChatPromptTemplate"]`
 *
 * When deserializing, the class path is validated against supported namespaces.
 *
 * ## Security model
 *
 * The `secretsFromEnv` parameter controls whether secrets can be loaded from environment
 * variables:
 *
 * - `false` (default): Secrets must be provided in `secretsMap`. If a secret is not
 *   found, `null` is returned instead of loading from environment variables.
 * - `true`: If a secret is not found in `secretsMap`, it will be loaded from
 *   environment variables. Use this only in trusted environments.
 *
 * ### Injection protection (escape-based)
 *
 * During serialization, plain objects that contain an `'lc'` key are escaped by wrapping
 * them: `{"__lc_escaped__": {...}}`. During deserialization, escaped objects are unwrapped
 * and returned as plain objects, NOT instantiated as LC objects.
 *
 * This is an allowlist approach: only objects explicitly produced by
 * `Serializable.toJSON()` (which are NOT escaped) are treated as LC objects;
 * everything else is user data.
 *
 * @module
 */

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
import { isEscapedObject, unescapeValue } from "./validation.js";

/**
 * Options for loading serialized LangChain objects.
 *
 * @remarks
 * **Security considerations:**
 *
 * Deserialization can instantiate arbitrary classes from the allowed namespaces.
 * When loading untrusted data, be aware that:
 *
 * 1. **`secretsFromEnv`**: Defaults to `false`. Setting to `true` allows the
 *    deserializer to read environment variables, which could leak secrets if
 *    the serialized data contains malicious secret references.
 *
 * 2. **`importMap` / `optionalImportsMap`**: These allow extending which classes
 *    can be instantiated. Never populate these from user input. Only include
 *    modules you explicitly trust.
 *
 * 3. **Class instantiation**: Allowed classes will have their constructors called
 *    with the deserialized kwargs. If a class performs side effects in its
 *    constructor (network calls, file I/O, etc.), those will execute.
 */
export interface LoadOptions {
  /**
   * A map of secrets to load. Keys are secret identifiers, values are the secret values.
   *
   * If a secret is not found in this map and `secretsFromEnv` is `false`, an error is
   * thrown. If `secretsFromEnv` is `true`, the secret will be loaded from environment
   * variables (if not found there either, an error is thrown).
   */
  secretsMap?: SecretMap;

  /**
   * Whether to load secrets from environment variables when not found in `secretsMap`.
   *
   * @default false
   *
   * @remarks
   * **Security warning:** Setting this to `true` allows the deserializer to read
   * environment variables, which could be a security risk if the serialized data
   * is not trusted. Only set this to `true` when deserializing data from trusted
   * sources (e.g., your own database, not user input).
   */
  secretsFromEnv?: boolean;

  /**
   * A map of optional imports. Keys are namespace paths (e.g., "langchain_community/llms"),
   * values are the imported modules.
   *
   * @remarks
   * **Security warning:** This extends which classes can be instantiated during
   * deserialization. Never populate this map with values derived from user input.
   * Only include modules that you explicitly trust and have reviewed.
   *
   * Classes in these modules can be instantiated with attacker-controlled kwargs
   * if the serialized data is untrusted.
   */
  optionalImportsMap?: OptionalImportMap;

  /**
   * Additional optional import entrypoints to allow beyond the defaults.
   *
   * @remarks
   * **Security warning:** This extends which namespace paths are considered valid
   * for deserialization. Never populate this array with values derived from user
   * input. Each entrypoint you add expands the attack surface for deserialization.
   */
  optionalImportEntrypoints?: string[];

  /**
   * Additional import map for the "langchain" namespace.
   *
   * @remarks
   * **Security warning:** This extends which classes can be instantiated during
   * deserialization. Never populate this map with values derived from user input.
   * Only include modules that you explicitly trust and have reviewed.
   *
   * Any class exposed through this map can be instantiated with attacker-controlled
   * kwargs if the serialized data is untrusted.
   */
  importMap?: Record<string, unknown>;

  /**
   * Maximum recursion depth allowed during deserialization.
   *
   * @default 50
   *
   * @remarks
   * This limit protects against denial-of-service attacks using deeply nested
   * JSON structures that could cause stack overflow. If your legitimate data
   * requires deeper nesting, you can increase this limit.
   */
  maxDepth?: number;
}

/**
 * Default maximum recursion depth for deserialization.
 * This provides protection against DoS attacks via deeply nested structures.
 */
const DEFAULT_MAX_DEPTH = 50;

function combineAliasesAndInvert(constructor: typeof Serializable) {
  const aliases: { [key: string]: string } = {};
  for (
    let current = constructor;
    current && current.prototype;
    current = Object.getPrototypeOf(current)
  ) {
    Object.assign(aliases, Reflect.get(current.prototype, "lc_aliases"));
  }
  return Object.entries(aliases).reduce(
    (acc, [key, value]) => {
      acc[value] = key;
      return acc;
    },
    {} as Record<string, string>
  );
}

interface ReviverContext {
  optionalImportsMap: OptionalImportMap;
  optionalImportEntrypoints: string[];
  secretsMap: SecretMap;
  secretsFromEnv: boolean;
  importMap: Record<string, unknown>;
  path: string[];
  depth: number;
  maxDepth: number;
}

/**
 * Recursively revive a value, handling escape markers and LC objects.
 *
 * This function handles:
 * 1. Escaped dicts - unwrapped and returned as plain objects
 * 2. LC secret objects - resolved from secretsMap or env
 * 3. LC constructor objects - instantiated
 * 4. Regular objects/arrays - recursed into
 */
async function reviver(this: ReviverContext, value: unknown): Promise<unknown> {
  const {
    optionalImportsMap,
    optionalImportEntrypoints,
    importMap,
    secretsMap,
    secretsFromEnv,
    path,
    depth,
    maxDepth,
  } = this;
  const pathStr = path.join(".");

  // Check recursion depth to prevent DoS via deeply nested structures
  if (depth > maxDepth) {
    throw new Error(
      `Maximum recursion depth (${maxDepth}) exceeded during deserialization. ` +
        `This may indicate a malicious payload or you may need to increase maxDepth.`
    );
  }

  // If not an object, return as-is
  if (typeof value !== "object" || value == null) {
    return value;
  }

  // Handle arrays - recurse into elements
  if (Array.isArray(value)) {
    return Promise.all(
      value.map((v, i) =>
        reviver.call({ ...this, path: [...path, `${i}`], depth: depth + 1 }, v)
      )
    );
  }

  // It's an object - check for escape marker FIRST
  const record = value as Record<string, unknown>;
  if (isEscapedObject(record)) {
    // This is an escaped user object - unwrap and return as-is (no LC processing)
    return unescapeValue(record);
  }

  // Check for LC secret object
  if (
    "lc" in record &&
    "type" in record &&
    "id" in record &&
    record.lc === 1 &&
    record.type === "secret"
  ) {
    const serialized = record as unknown as SerializedSecret;
    const [key] = serialized.id;
    if (key in secretsMap) {
      return secretsMap[key as keyof SecretMap];
    } else if (secretsFromEnv) {
      const secretValueInEnv = getEnvironmentVariable(key);
      if (secretValueInEnv) {
        return secretValueInEnv;
      }
    }
    throw new Error(`Missing secret "${key}" at ${pathStr}`);
  }

  // Check for LC not_implemented object
  if (
    "lc" in record &&
    "type" in record &&
    "id" in record &&
    record.lc === 1 &&
    record.type === "not_implemented"
  ) {
    const serialized = record as unknown as SerializedNotImplemented;
    const str = JSON.stringify(serialized);
    throw new Error(
      `Trying to load an object that doesn't implement serialization: ${pathStr} -> ${str}`
    );
  }

  // Check for LC constructor object
  if (
    "lc" in record &&
    "type" in record &&
    "id" in record &&
    "kwargs" in record &&
    record.lc === 1 &&
    record.type === "constructor"
  ) {
    const serialized = record as unknown as SerializedConstructor;
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
        module =
          await optionalImportsMap[
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
      { ...this, path: [...path, "kwargs"], depth: depth + 1 },
      serialized.kwargs
    );

    // Construct the object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  }

  // Regular object - recurse into values
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    result[key] = await reviver.call(
      { ...this, path: [...path, key], depth: depth + 1 },
      val
    );
  }
  return result;
}

/**
 * Load a LangChain object from a JSON string.
 *
 * @param text - The JSON string to parse and load.
 * @param options - Options for loading.
 * @returns The loaded LangChain object.
 *
 * @example
 * ```typescript
 * import { load } from "@langchain/core/load";
 * import { AIMessage } from "@langchain/core/messages";
 *
 * // Basic usage - secrets must be provided explicitly
 * const msg = await load<AIMessage>(jsonString);
 *
 * // With secrets from a map
 * const msg = await load<AIMessage>(jsonString, {
 *   secretsMap: { OPENAI_API_KEY: "sk-..." }
 * });
 *
 * // Allow loading secrets from environment (use with caution)
 * const msg = await load<AIMessage>(jsonString, {
 *   secretsFromEnv: true
 * });
 * ```
 */
export async function load<T>(text: string, options?: LoadOptions): Promise<T> {
  const json = JSON.parse(text);

  const context: ReviverContext = {
    optionalImportsMap: options?.optionalImportsMap ?? {},
    optionalImportEntrypoints: options?.optionalImportEntrypoints ?? [],
    secretsMap: options?.secretsMap ?? {},
    secretsFromEnv: options?.secretsFromEnv ?? false,
    importMap: options?.importMap ?? {},
    path: ["$"],
    depth: 0,
    maxDepth: options?.maxDepth ?? DEFAULT_MAX_DEPTH,
  };

  return reviver.call(context, json) as Promise<T>;
}
