import { load as coreLoad } from "@langchain/core/load";
import { optionalImportEntrypoints } from "./import_constants.js";
import * as importMap from "./import_map.js";
import { OptionalImportMap } from "./import_type.js";

/**
 * Load a LangChain module from a serialized text representation.
 * NOTE: This functionality is currently in beta.
 * Loaded classes may change independently of semver.
 *
 * **WARNING — insecure deserialization risk.** This function instantiates
 * classes and invokes constructors based on the contents of `text`. Never
 * call this on untrusted or user-supplied input. Only deserialize data that
 * originates from a trusted source you control.
 *
 * See `@langchain/core/load` {@link LoadOptions} for detailed security
 * guidance on `secretsFromEnv`, `secretsMap`, and import maps.
 *
 * @param text Serialized text representation of the module.
 * @param secretsMap
 * @param optionalImportsMap
 * @param additionalImportsMap
 * @param secretsFromEnv
 * @returns A loaded instance of a LangChain module.
 */
export async function load<T>(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  secretsMap: Record<string, any> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optionalImportsMap: OptionalImportMap & Record<string, any> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additionalImportsMap: Record<string, any> = {},
  secretsFromEnv?: boolean
): Promise<T> {
  return coreLoad(text, {
    secretsMap,
    optionalImportsMap,
    optionalImportEntrypoints,
    importMap: { ...importMap, ...additionalImportsMap },
    secretsFromEnv,
  });
}
