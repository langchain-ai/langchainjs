import {
  optionalImportEntrypoints,
  OptionalImportMap
} from "@langchain/community/load";
import { load as coreLoad } from "@langchain/core/load";
import * as importMap from "./import_map.js";

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
    importMap
  });
}
