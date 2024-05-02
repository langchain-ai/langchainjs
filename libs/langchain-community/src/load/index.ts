import { load as coreLoad } from "@langchain/core/load";
import { type OptionalImportMap, type SecretMap } from "./import_type.js";
import * as importMap from "./import_map.js";
import { optionalImportEntrypoints } from "./import_constants.js";

export {
  optionalImportEntrypoints,
  importMap,
  type OptionalImportMap,
  type SecretMap,
};

/**
 * Load a LangChain module from a serialized text representation.
 * NOTE: This functionality is currently in beta.
 * Loaded classes may change independently of semver.
 * @param text Serialized text representation of the module.
 * @param secretsMap
 * @param optionalImportsMap
 * @returns A loaded instance of a LangChain module.
 */
export async function load<T>(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  secretsMap: Record<string, any> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optionalImportsMap: OptionalImportMap & Record<string, any> = {}
): Promise<T> {
  return coreLoad(text, {
    secretsMap,
    optionalImportsMap,
    optionalImportEntrypoints,
    importMap,
  });
}
