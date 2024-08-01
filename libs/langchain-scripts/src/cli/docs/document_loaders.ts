import * as path from "node:path";
import * as fs from "node:fs";
import _ from "lodash";
import {
  boldText,
  getUserInput,
  greenText,
  redBackground,
} from "../utils/get-input.js";

const NODE_OR_WEB_PLACEHOLDER = "__fs_or_web__";
const PACKAGE_NAME_PLACEHOLDER = "__package_name__";
const MODULE_NAME_PLACEHOLDER = "__ModuleName__";
const PACKAGE_NAME_SHORT_SNAKE_CASE_PLACEHOLDER =
  "__package_name_short_snake_case__";
const PACKAGE_NAME_SNAKE_CASE_PLACEHOLDER = "__package_name_snake_case__";
const PACKAGE_IMPORT_PATH_PLACEHOLDER = "__import_path__";

// This should not be prefixed with `Chat` as it's used for API keys.
const MODULE_NAME_ALL_CAPS_PLACEHOLDER = "__MODULE_NAME_ALL_CAPS__";

const SERIALIZABLE_PLACEHOLDER = "__serializable__";
const LOCAL_PLACEHOLDER = "__local__";
const PY_SUPPORT_PLACEHOLDER = "__py_support__";

const WEB_SUPPORT_PLACEHOLDER = "__web_support__";
const NODE_SUPPORT_PLACEHOLDER = "__fs_support__";

const API_REF_BASE_MODULE_URL = `https://api.js.langchain.com/classes/langchain_community_document_loaders_${NODE_OR_WEB_PLACEHOLDER}_${PACKAGE_NAME_PLACEHOLDER}.${MODULE_NAME_PLACEHOLDER}.html`;

const TEMPLATE_PATH = path.resolve(
  "./src/cli/docs/templates/document_loaders.ipynb"
);
const INTEGRATIONS_DOCS_PATH = path.resolve(
  "../../docs/core_docs/docs/integrations/document_loaders"
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
  nodeSupport: boolean;
  webSupport: boolean;
  serializable: boolean;
  pySupport: boolean;
  local: boolean;
};

async function promptExtraFields(): Promise<ExtraFields> {
  const hasNodeSupport = await getUserInput(
    "Does this integration support Node environments? (y/n) ",
    undefined,
    true
  );
  const hasWebSupport = await getUserInput(
    "Does this integration support web environments? (y/n) ",
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
  const hasLocalSupport = await getUserInput(
    "Does this integration support running locally? (y/n) ",
    undefined,
    true
  );

  return {
    nodeSupport: hasNodeSupport.toLowerCase() === "y",
    webSupport: hasWebSupport.toLowerCase() === "y",
    serializable: hasSerializable.toLowerCase() === "y",
    pySupport: hasPySupport.toLowerCase() === "y",
    local: hasLocalSupport.toLowerCase() === "y",
  };
}

export async function fillDocLoaderIntegrationDocTemplate(fields: {
  packageName: string;
  moduleName: string;
  webSupport?: boolean;
  nodeSupport?: boolean;
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

  const formattedApiRefModuleUrl = API_REF_BASE_MODULE_URL.replace(
    PACKAGE_NAME_PLACEHOLDER,
    fields.packageName
  )
    .replace(MODULE_NAME_PLACEHOLDER, fields.moduleName)
    .replace(NODE_OR_WEB_PLACEHOLDER, extraFields?.webSupport ? "web" : "fs");

  const success = await fetchAPIRefUrl(formattedApiRefModuleUrl);
  if (!success) {
    // Don't error out because this might be used before the package is released.
    console.error("Invalid package or module name. API reference not found.");
  }

  const packageNameShortSnakeCase = fields.packageName.replaceAll("-", "_");
  const fullPackageNameSnakeCase = `langchain_community_document_loaders_${
    extraFields?.webSupport ? "web" : "fs"
  }_${packageNameShortSnakeCase}`;
  const fullPackageImportPath = `@langchain/community/document_loaders/${
    extraFields?.webSupport ? "web" : "fs"
  }/${fields.packageName}`;

  let moduleNameAllCaps = _.snakeCase(fields.moduleName).toUpperCase();
  if (moduleNameAllCaps.endsWith("DOCUMENT_LOADER")) {
    moduleNameAllCaps = moduleNameAllCaps.replace("DOCUMENT_LOADER", "");
  }

  const docTemplate = (await fs.promises.readFile(TEMPLATE_PATH, "utf-8"))
    .replaceAll(PACKAGE_NAME_PLACEHOLDER, fields.packageName)
    .replaceAll(PACKAGE_NAME_SNAKE_CASE_PLACEHOLDER, fullPackageNameSnakeCase)
    .replaceAll(
      PACKAGE_NAME_SHORT_SNAKE_CASE_PLACEHOLDER,
      packageNameShortSnakeCase
    )
    .replaceAll(PACKAGE_IMPORT_PATH_PLACEHOLDER, fullPackageImportPath)
    .replaceAll(MODULE_NAME_PLACEHOLDER, fields.moduleName)
    .replaceAll(MODULE_NAME_ALL_CAPS_PLACEHOLDER, moduleNameAllCaps)
    .replace(WEB_SUPPORT_PLACEHOLDER, extraFields?.webSupport ? "✅" : "❌")
    .replace(NODE_SUPPORT_PLACEHOLDER, extraFields?.nodeSupport ? "✅" : "❌")
    .replace(LOCAL_PLACEHOLDER, extraFields?.local ? "✅" : "❌")
    .replace(
      SERIALIZABLE_PLACEHOLDER,
      extraFields?.serializable ? "✅" : "beta"
    )
    .replace(PY_SUPPORT_PLACEHOLDER, extraFields?.pySupport ? "✅" : "❌");

  const docPath = path.join(
    INTEGRATIONS_DOCS_PATH,
    extraFields?.webSupport ? "web_loaders" : "file_loaders",
    `${packageNameShortSnakeCase}.ipynb`
  );
  await fs.promises.writeFile(docPath, docTemplate);
  const prettyDocPath = docPath.split("docs/core_docs/")[1];

  const updatePythonDocUrlText = `  ${redBackground(
    "- Update the Python documentation URL with the proper URL."
  )}`;
  const successText = `\nSuccessfully created new document loader integration doc at ${prettyDocPath}.`;

  console.log(
    `${greenText(successText)}\n
${boldText("Next steps:")}
${extraFields?.pySupport ? updatePythonDocUrlText : ""}
  - Run all code cells in the generated doc to record the outputs.
  - Add extra sections on integration specific features.\n`
  );
}
