import { LangChainConfig } from "./types.js";

export function _verifyObjectIsLangChainConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any
): obj is LangChainConfig {
  if (typeof obj !== "object") {
    return false;
  }
  if (
    !("entrypoints" in obj) ||
    !("tsConfigPath" in obj) ||
    !("cjsSource" in obj) ||
    !("cjsDestination" in obj) ||
    !("abs" in obj)
  ) {
    return false;
  }
  if (typeof obj.entrypoints !== "object") {
    return false;
  }
  if (Object.values(obj.entrypoints).some((v) => typeof v !== "string")) {
    return false;
  }
  if (
    typeof obj.tsConfigPath !== "string" ||
    typeof obj.cjsSource !== "string" ||
    typeof obj.cjsDestination !== "string"
  ) {
    return false;
  }
  if (typeof obj.abs !== "function") {
    return false;
  }

  // Optional fields
  if (
    "requiresOptionalDependency" in obj &&
    (!Array.isArray(obj.requiresOptionalDependency) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.requiresOptionalDependency.some((v: any) => typeof v !== "string"))
  ) {
    return false;
  }
  if (
    "deprecatedNodeOnly" in obj &&
    (!Array.isArray(obj.deprecatedNodeOnly) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.deprecatedNodeOnly.some((v: any) => typeof v !== "string"))
  ) {
    return false;
  }
  if (
    "deprecatedOmitFromImportMap" in obj &&
    (!Array.isArray(obj.deprecatedOmitFromImportMap) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.deprecatedOmitFromImportMap.some((v: any) => typeof v !== "string"))
  ) {
    return false;
  }
  if ("packageSuffix" in obj && typeof obj.packageSuffix !== "string") {
    return false;
  }
  if (
    "shouldTestExports" in obj &&
    typeof obj.shouldTestExports !== "boolean"
  ) {
    return false;
  }
  if (
    "extraImportMapEntries" in obj &&
    !Array.isArray(obj.deprecatedOmitFromImportMap)
  ) {
    return false;
  }
  if (
    "gitignorePaths" in obj &&
    (!Array.isArray(obj.gitignorePaths) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.gitignorePaths.some((v: any) => typeof v !== "string"))
  ) {
    return false;
  }
  if ("internals" in obj && !Array.isArray(obj.internals)) {
    return false;
  }
  return true;
}
