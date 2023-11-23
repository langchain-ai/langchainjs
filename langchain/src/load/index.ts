import { load as coreLoad } from "@langchain/core/load";
import { optionalImportEntrypoints } from "./import_constants.js";
import * as importMap from "./import_map.js";
import { OptionalImportMap } from "./import_type.js";

export async function load<T>(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  secretsMap: Record<string, any> = {},
  optionalImportsMap: OptionalImportMap = {}
): Promise<T> {
  return coreLoad(text, {
    secretsMap,
    optionalImportsMap,
    optionalImportEntrypoints,
    importMap,
  });
}
