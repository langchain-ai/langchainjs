import * as path from "node:path";
import * as fs from "node:fs";
import {
  boldText,
  getUserInput,
  greenText,
  redBackground,
} from "../utils/get-input.js";
import _ from "lodash";
import { camelCaseToSpaced } from "../utils/camel-case-to-spaces.js";

const SIDEBAR_LABEL_PLACEHOLDER = "__sidebar_label__";

const PACKAGE_NAME_PLACEHOLDER = "__package_name__";
const PACKAGE_NAME_SHORT_SNAKE_CASE_PLACEHOLDER =
  "__package_name_short_snake_case__";
const PACKAGE_NAME_SNAKE_CASE_PLACEHOLDER = "__package_name_snake_case__";
const PACKAGE_NAME_PRETTY_PLACEHOLDER = "__package_name_pretty__";
const PACKAGE_IMPORT_PATH_PLACEHOLDER = "__import_path__";
const MODULE_NAME_PLACEHOLDER = "__ModuleName__";
// This should not be prefixed with `Chat` as it's used for API keys.
const MODULE_NAME_ALL_CAPS_PLACEHOLDER = "__MODULE_NAME_ALL_CAPS__";

const SERIALIZABLE_PLACEHOLDER = "__serializable__";
const LOCAL_PLACEHOLDER = "__local__";
const PY_SUPPORT_PLACEHOLDER = "__py_support__";

const API_REF_BASE_PACKAGE_URL = `https://api.js.langchain.com/modules/langchain_${PACKAGE_NAME_PLACEHOLDER}.html`;
const API_REF_BASE_MODULE_URL = `https://api.js.langchain.com/classes/langchain_${PACKAGE_NAME_PLACEHOLDER}.${MODULE_NAME_PLACEHOLDER}.html`;

const TEMPLATE_PATH = path.resolve("./src/cli/docs/templates/llms.ipynb");
const INTEGRATIONS_DOCS_PATH = path.resolve(
  "../../docs/core_docs/docs/integrations/llms"
);

const fetchAPIRefUrl = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url);
    if (res.status !== 200) {
      throw new Error(`API Reference URL ${url} not found.`);
    }
    return true;
  } catch (_) {
    return false;
  }
};

type ExtraFields = {
  local: boolean;
  serializable: boolean;
  pySupport: boolean;
};

async function promptExtraFields(): Promise<ExtraFields> {
  const hasLocal = await getUserInput(
    "Does this integration support local usage? (y/n) ",
    undefined,
    true
  );
  const hasSerializable = await getUserInput(
    "Does this integration support serializable output? (y/n) ",
    undefined,
    true
  );
  const hasPySupport = await getUserInput(
    "Does this integration have Python support? (y/n) ",
    undefined,
    true
  );

  return {
    local: hasLocal.toLowerCase() === "y",
    serializable: hasSerializable.toLowerCase() === "y",
    pySupport: hasPySupport.toLowerCase() === "y",
  };
}

export async function fillLLMIntegrationDocTemplate(fields: {
  packageName: string;
  moduleName: string;
  isCommunity: boolean;
}) {
  // Ask the user if they'd like to fill in extra fields, if so, prompt them.
  let extraFields: ExtraFields | undefined;
  const shouldPromptExtraFields = await getUserInput(
    "Would you like to fill out optional fields? (y/n) ",
    "white_background"
  );
  if (shouldPromptExtraFields.toLowerCase() === "y") {
    extraFields = await promptExtraFields();
  }

  let formattedApiRefPackageUrl = "";
  let formattedApiRefModuleUrl = "";
  if (fields.isCommunity) {
    formattedApiRefPackageUrl = API_REF_BASE_PACKAGE_URL.replace(
      PACKAGE_NAME_PLACEHOLDER,
      `community_llms_${fields.packageName}`
    );
    formattedApiRefModuleUrl = API_REF_BASE_MODULE_URL.replace(
      PACKAGE_NAME_PLACEHOLDER,
      `community_llms_${fields.packageName}`
    ).replace(MODULE_NAME_PLACEHOLDER, fields.moduleName);
  } else {
    formattedApiRefPackageUrl = API_REF_BASE_PACKAGE_URL.replace(
      PACKAGE_NAME_PLACEHOLDER,
      fields.packageName
    );
    formattedApiRefModuleUrl = API_REF_BASE_MODULE_URL.replace(
      PACKAGE_NAME_PLACEHOLDER,
      fields.packageName
    ).replace(MODULE_NAME_PLACEHOLDER, fields.moduleName);
  }

  const success = await Promise.all([
    fetchAPIRefUrl(formattedApiRefPackageUrl),
    fetchAPIRefUrl(formattedApiRefModuleUrl),
  ]);
  if (success.some((s) => s === false)) {
    // Don't error out because this might be used before the package is released.
    console.error("Invalid package or module name. API reference not found.");
  }

  const packageNameShortSnakeCase = fields.packageName.replaceAll("-", "_");
  let fullPackageNameSnakeCase = "";
  let packageNamePretty = "";
  let fullPackageImportPath = "";

  if (fields.isCommunity) {
    fullPackageNameSnakeCase = `langchain_community_llms_${packageNameShortSnakeCase}`;
    fullPackageImportPath = `@langchain/community/llms/${fields.packageName}`;
    packageNamePretty = "@langchain/community";
  } else {
    fullPackageNameSnakeCase = `langchain_${packageNameShortSnakeCase}`;
    packageNamePretty = `@langchain/${fields.packageName}`;
    fullPackageImportPath = packageNamePretty;
  }

  let moduleNameAllCaps = fields.moduleName.toUpperCase();
  if (moduleNameAllCaps.endsWith("_LLM")) {
    moduleNameAllCaps = moduleNameAllCaps.replace("_LLM", "");
  } else if (moduleNameAllCaps.endsWith("LLM")) {
    moduleNameAllCaps = moduleNameAllCaps.replace("LLM", "");
  }

  let sidebarLabel = camelCaseToSpaced(fields.moduleName);
  if (sidebarLabel.includes("llm")) {
    sidebarLabel = sidebarLabel.replace("llm", "");
  } else if (sidebarLabel.includes("LLM")) {
    sidebarLabel = sidebarLabel.replace("LLM", "");
  } else if (sidebarLabel.includes("Llm")) {
    sidebarLabel = sidebarLabel.replace("Llm", "");
  }
  // remove extra spaces
  sidebarLabel = sidebarLabel.trim().replaceAll("  ", " ");

  const docTemplate = (await fs.promises.readFile(TEMPLATE_PATH, "utf-8"))
    .replace(SIDEBAR_LABEL_PLACEHOLDER, _.capitalize(sidebarLabel))
    .replaceAll(PACKAGE_NAME_PLACEHOLDER, fields.packageName)
    .replaceAll(PACKAGE_NAME_SNAKE_CASE_PLACEHOLDER, fullPackageNameSnakeCase)
    .replaceAll(
      PACKAGE_NAME_SHORT_SNAKE_CASE_PLACEHOLDER,
      packageNameShortSnakeCase
    )
    .replaceAll(PACKAGE_NAME_PRETTY_PLACEHOLDER, packageNamePretty)
    .replaceAll(PACKAGE_IMPORT_PATH_PLACEHOLDER, fullPackageImportPath)
    .replaceAll(MODULE_NAME_PLACEHOLDER, fields.moduleName)
    .replaceAll(MODULE_NAME_ALL_CAPS_PLACEHOLDER, moduleNameAllCaps)
    .replace(LOCAL_PLACEHOLDER, extraFields?.local ? "✅" : "❌")
    .replace(
      SERIALIZABLE_PLACEHOLDER,
      extraFields?.serializable ? "✅" : "beta"
    )
    .replace(PY_SUPPORT_PLACEHOLDER, extraFields?.pySupport ? "✅" : "❌");

  const docPath = path.join(
    INTEGRATIONS_DOCS_PATH,
    `${packageNameShortSnakeCase}.ipynb`
  );
  await fs.promises.writeFile(docPath, docTemplate);
  const prettyDocPath = docPath.split("docs/core_docs/")[1];

  const updatePythonDocUrlText = `  ${redBackground(
    "- Update the Python documentation URL with the proper URL."
  )}`;
  const successText = `\nSuccessfully created new chat model integration doc at ${prettyDocPath}.`;

  console.log(
    `${greenText(successText)}\n
${boldText("Next steps:")}
${extraFields?.pySupport ? updatePythonDocUrlText : ""}
  - Run all code cells in the generated doc to record the outputs.
  - Add extra sections on integration specific features.\n`
  );
}
