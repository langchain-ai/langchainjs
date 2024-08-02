import * as path from "node:path";
import * as fs from "node:fs";
import _ from "lodash";
import {
  boldText,
  getUserInput,
  greenText,
  redBackground,
} from "../utils/get-input.js";
import { camelCaseToSpaced } from "../utils/camel-case-to-spaces.js";

const SIDEBAR_LABEL_PLACEHOLDER = "__sidebar_label__";

const NODE_OR_WEB_PLACEHOLDER = "__fs_or_web__";
const NODE_OR_WEB_IMPORT_PATH_PLACEHOLDER = "__fs_or_web_import_path__";
const FILE_NAME_PLACEHOLDER = "__file_name__";
const MODULE_NAME_PLACEHOLDER = "__ModuleName__";

const API_REF_BASE_PACKAGE_URL = `https://api.js.langchain.com/modules/langchain_community_document_loaders_${NODE_OR_WEB_PLACEHOLDER}_${FILE_NAME_PLACEHOLDER}.html`;
const API_REF_BASE_MODULE_URL = `https://v02.api.js.langchain.com/classes/langchain_community_document_loaders_${NODE_OR_WEB_PLACEHOLDER}_${FILE_NAME_PLACEHOLDER}.${MODULE_NAME_PLACEHOLDER}.html`;

const LOCAL_PLACEHOLDER = "__local__";
const PY_SUPPORT_PLACEHOLDER = "__py_support__";

const WEB_SUPPORT_PLACEHOLDER = "__web_support__";
const NODE_SUPPORT_PLACEHOLDER = "__fs_support__";

const NODE_ONLY_SIDEBAR_BADGE_PLACEHOLDER = "__node_only_sidebar__";
const NODE_ONLY_TOOL_TIP_PLACEHOLDER = "__node_only_tooltip__";

// This should not be suffixed with `Loader` as it's used for API keys.
const MODULE_NAME_ALL_CAPS_PLACEHOLDER = "__MODULE_NAME_ALL_CAPS__";

const TEMPLATE_PATH = path.resolve(
  "./src/cli/docs/templates/document_loaders.ipynb"
);
const INTEGRATIONS_DOCS_PATH = path.resolve(
  "../../docs/core_docs/docs/integrations/document_loaders"
);

const NODE_ONLY_TOOLTIP =
  "```{=mdx}\n\n:::tip Compatibility\n\nOnly available on Node.js.\n\n:::\n\n```\n";
const NODE_ONLY_SIDEBAR_BADGE = `sidebar_class_name: node-only`;

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
  webLoader: boolean;
  nodeOnly: boolean;
  pySupport: boolean;
  local: boolean;
};

async function promptExtraFields(): Promise<ExtraFields> {
  const isWebLoader = await getUserInput(
    "Is this integration a web loader? (y/n) ",
    undefined,
    true
  );
  const isNodeOnly = await getUserInput(
    "Does this integration _only_ support Node environments? (y/n) ",
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
    webLoader: isWebLoader.toLowerCase() === "y",
    nodeOnly: isNodeOnly.toLowerCase() === "y",
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

  const formattedPackageApiRefUrl = API_REF_BASE_PACKAGE_URL.replace(
    NODE_OR_WEB_PLACEHOLDER,
    extraFields?.webLoader ? "web" : "fs"
  ).replace(FILE_NAME_PLACEHOLDER, fields.packageName);

  const formattedApiRefModuleUrl = API_REF_BASE_MODULE_URL.replace(
    NODE_OR_WEB_PLACEHOLDER,
    extraFields?.webLoader ? "web" : "fs"
  )
    .replace(FILE_NAME_PLACEHOLDER, fields.packageName)
    .replace(MODULE_NAME_PLACEHOLDER, fields.moduleName);

  const success = await Promise.all([
    fetchAPIRefUrl(formattedApiRefModuleUrl),
    fetchAPIRefUrl(formattedPackageApiRefUrl),
  ]);
  if (success.find((s) => s === false)) {
    // Don't error out because this might be used before the package is released.
    console.error("Invalid package or module name. API reference not found.");
  }

  let moduleNameAllCaps = _.snakeCase(fields.moduleName).toUpperCase();
  if (moduleNameAllCaps.endsWith("_LOADER")) {
    moduleNameAllCaps = moduleNameAllCaps.replace("_LOADER", "");
  }

  const sidebarLabel = fields.moduleName.includes("Loader")
    ? fields.moduleName.replace("Loader", "")
    : fields.moduleName;

  const docTemplate = (await fs.promises.readFile(TEMPLATE_PATH, "utf-8"))
    .replaceAll(
      SIDEBAR_LABEL_PLACEHOLDER,
      _.capitalize(camelCaseToSpaced(sidebarLabel))
    )
    .replaceAll(NODE_OR_WEB_PLACEHOLDER, extraFields?.webLoader ? "web" : "fs")
    .replaceAll(MODULE_NAME_PLACEHOLDER, fields.moduleName)
    .replaceAll(MODULE_NAME_ALL_CAPS_PLACEHOLDER, moduleNameAllCaps)
    .replaceAll(
      NODE_OR_WEB_IMPORT_PATH_PLACEHOLDER,
      extraFields?.webLoader ? "web" : "fs"
    )
    .replaceAll(FILE_NAME_PLACEHOLDER, fields.packageName)
    .replaceAll(
      NODE_ONLY_SIDEBAR_BADGE_PLACEHOLDER,
      extraFields?.nodeOnly ? NODE_ONLY_SIDEBAR_BADGE : ""
    )
    .replaceAll(
      NODE_ONLY_TOOL_TIP_PLACEHOLDER,
      extraFields?.nodeOnly ? NODE_ONLY_TOOLTIP : ""
    )
    .replaceAll(WEB_SUPPORT_PLACEHOLDER, extraFields?.webLoader ? "✅" : "❌")
    .replaceAll(NODE_SUPPORT_PLACEHOLDER, extraFields?.nodeOnly ? "✅" : "❌")
    .replaceAll(LOCAL_PLACEHOLDER, extraFields?.local ? "✅" : "❌")
    .replaceAll(PY_SUPPORT_PLACEHOLDER, extraFields?.pySupport ? "✅" : "❌");

  const docPath = path.join(
    INTEGRATIONS_DOCS_PATH,
    extraFields?.webLoader ? "web_loaders" : "file_loaders",
    `${fields.packageName}.ipynb`
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
