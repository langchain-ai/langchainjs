import { LangChainConfig } from "./types.js";

export function _verifyObjectIsLangChainConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any
): obj is LangChainConfig {
  if (typeof obj !== "object") {
    console.error("LangChain config file is not an object");
    return false;
  }
  if (
    !("entrypoints" in obj) ||
    !("tsConfigPath" in obj) ||
    !("cjsSource" in obj) ||
    !("cjsDestination" in obj) ||
    !("abs" in obj)
  ) {
    console.error(
      `LangChain config file is missing required fields. One of: entrypoints, tsConfigPath, cjsSource, cjsDestination, abs`
    );
    return false;
  }
  if (typeof obj.entrypoints !== "object") {
    console.error(
      "entrypoints field in LangChain config file is not an object"
    );
    return false;
  }
  if (Object.values(obj.entrypoints).some((v) => typeof v !== "string")) {
    console.error(
      "entrypoints field in LangChain config file is not an object of strings"
    );
    return false;
  }
  if (
    typeof obj.tsConfigPath !== "string" ||
    typeof obj.cjsSource !== "string" ||
    typeof obj.cjsDestination !== "string"
  ) {
    console.error(
      "tsConfigPath, cjsSource, or cjsDestination fields in LangChain config file are not strings"
    );
    return false;
  }
  if (typeof obj.abs !== "function") {
    console.error("abs field in LangChain config file is not a function");
    return false;
  }

  // Optional fields
  if (
    "requiresOptionalDependency" in obj &&
    (!Array.isArray(obj.requiresOptionalDependency) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.requiresOptionalDependency.some((v: any) => typeof v !== "string"))
  ) {
    console.error(
      "requiresOptionalDependency field in LangChain config file is not an array of strings"
    );
    return false;
  }
  if (
    "deprecatedNodeOnly" in obj &&
    (!Array.isArray(obj.deprecatedNodeOnly) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.deprecatedNodeOnly.some((v: any) => typeof v !== "string"))
  ) {
    console.error(
      "deprecatedNodeOnly field in LangChain config file is not an array of strings"
    );
    return false;
  }
  if (
    "deprecatedOmitFromImportMap" in obj &&
    (!Array.isArray(obj.deprecatedOmitFromImportMap) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.deprecatedOmitFromImportMap.some((v: any) => typeof v !== "string"))
  ) {
    console.error(
      "deprecatedOmitFromImportMap field in LangChain config file is not an array of strings"
    );
    return false;
  }
  if ("packageSuffix" in obj && typeof obj.packageSuffix !== "string") {
    console.error(
      "packageSuffix field in LangChain config file is not a string"
    );
    return false;
  }
  if (
    "shouldTestExports" in obj &&
    typeof obj.shouldTestExports !== "boolean"
  ) {
    console.error(
      "shouldTestExports field in LangChain config file is not a boolean"
    );
    return false;
  }
  if (
    "extraImportMapEntries" in obj &&
    !Array.isArray(obj.extraImportMapEntries)
  ) {
    console.error(
      "extraImportMapEntries field in LangChain config file is not an array"
    );
    return false;
  }
  if (
    "gitignorePaths" in obj &&
    (!Array.isArray(obj.gitignorePaths) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.gitignorePaths.some((v: any) => typeof v !== "string"))
  ) {
    console.error(
      "gitignorePaths field in LangChain config file is not an array of strings"
    );
    return false;
  }
  if ("internals" in obj && !Array.isArray(obj.internals)) {
    console.error("internals field in LangChain config file is not an array");
    return false;
  }
  return true;
}
