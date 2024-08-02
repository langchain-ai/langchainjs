import * as path from "node:path";
import * as fs from "node:fs";
import {
  boldText,
  getUserInput,
  greenText,
  redBackground,
} from "../utils/get-input.js";

const PACKAGE_NAME_PLACEHOLDER = "__package_name__";
const MODULE_NAME_PLACEHOLDER = "__ModuleName__";
const SIDEBAR_LABEL_PLACEHOLDER = "__sidebar_label__";
const FULL_IMPORT_PATH_PLACEHOLDER = "__full_import_path__";
const HAS_CLOUD_OFFERING_PLACEHOLDER = "__has_cloud_offering__";
const CAN_SELF_HOST_PLACEHOLDER = "__can_self_host__";
const PY_SUPPORT_PLACEHOLDER = "__py_support__";
const API_REF_MODULE_PLACEHOLDER = "__api_ref_module__";
const PYTHON_DOC_URL_PLACEHOLDER = "__python_doc_url__";

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

const TEMPLATE_PATH = path.resolve("./src/cli/docs/templates/retrievers.ipynb");
const INTEGRATIONS_DOCS_PATH = path.resolve(
  "../../docs/core_docs/docs/integrations/retrievers"
);

type ExtraFields = {
  packageName: string;
  fullImportPath?: string;
  hasCloudOffering: boolean;
  canSelfHost: boolean;
  pySupport: boolean;
};

async function promptExtraFields(fields: {
  packageNameGuess: string;
  isCommunity: boolean;
}): Promise<ExtraFields> {
  const { packageNameGuess, isCommunity } = fields;

  const hasCloudOffering = await getUserInput(
    "Does this retriever support self hosting? (y/n) ",
    undefined,
    true
  );
  const canSelfHost = await getUserInput(
    "Does this retriever have a cloud offering? (y/n) ",
    undefined,
    true
  );
  const hasPySupport = await getUserInput(
    "Does this integration have Python support? (y/n) ",
    undefined,
    true
  );

  let packageName = packageNameGuess;
  if (!isCommunity) {
    // If it's not community, get the package name.

    const isOtherPackageName = await getUserInput(
      `Is this integration part of the ${packageNameGuess} package? (y/n) `
    );
    if (isOtherPackageName.toLowerCase() === "n") {
      packageName = await getUserInput(
        "What is the name of the package this integration is located in? (e.g @langchain/openai) ",
        undefined,
        true
      );
      if (
        !packageName.startsWith("@langchain/") &&
        !packageName.startsWith("langchain/")
      ) {
        packageName = await getUserInput(
          "Packages must start with either '@langchain/' or 'langchain/'. Please enter a valid package name: ",
          undefined,
          true
        );
      }
    }
  }

  // If it's community or langchain, ask for the full import path
  let fullImportPath: string | undefined;
  if (
    packageName.startsWith("@langchain/community") ||
    packageName.startsWith("langchain/")
  ) {
    fullImportPath = await getUserInput(
      "What is the full import path of the module? (e.g '@langchain/community/retrievers/tavily_search_api') ",
      undefined,
      true
    );
  }

  return {
    packageName,
    fullImportPath,
    canSelfHost: canSelfHost.toLowerCase() === "y",
    hasCloudOffering: hasCloudOffering.toLowerCase() === "y",
    pySupport: hasPySupport.toLowerCase() === "y",
  };
}

export async function fillRetrieverIntegrationDocTemplate(fields: {
  packageName: string;
  moduleName: string;
  isCommunity: boolean;
}) {
  const sidebarLabel = fields.moduleName.replace("Retriever", "");
  const pyDocUrl = `https://python.langchain.com/v0.2/docs/integrations/retrievers/${sidebarLabel.toLowerCase()}/`;
  const extraFields = await promptExtraFields({
    packageNameGuess: `@langchain/${fields.packageName}`,
    isCommunity: fields.isCommunity,
  });
  const { pySupport } = extraFields;
  const { canSelfHost } = extraFields;
  const { hasCloudOffering } = extraFields;
  const { packageName } = extraFields;
  const fullImportPath = extraFields.fullImportPath ?? extraFields.packageName;

  const apiRefModuleUrl = `https://api.js.langchain.com/classes/${fullImportPath
    .replace("@", "")
    .replaceAll("/", "_")
    .replaceAll("-", "_")}.${fields.moduleName}.html`;
  const apiRefPackageUrl = apiRefModuleUrl
    .replace("/classes/", "/modules/")
    .replace(`.${fields.moduleName}.html`, ".html");

  const apiRefUrlSuccesses = await Promise.all([
    fetchAPIRefUrl(apiRefModuleUrl),
    fetchAPIRefUrl(apiRefPackageUrl),
  ]);
  if (apiRefUrlSuccesses.find((s) => !s)) {
    console.warn(
      "API ref URLs invalid. Please manually ensure they are correct."
    );
  }

  const docTemplate = (await fs.promises.readFile(TEMPLATE_PATH, "utf-8"))
    .replaceAll(PACKAGE_NAME_PLACEHOLDER, packageName)
    .replaceAll(MODULE_NAME_PLACEHOLDER, fields.moduleName)
    .replaceAll(SIDEBAR_LABEL_PLACEHOLDER, sidebarLabel)
    .replaceAll(FULL_IMPORT_PATH_PLACEHOLDER, fullImportPath)
    .replace(HAS_CLOUD_OFFERING_PLACEHOLDER, hasCloudOffering ? "✅" : "❌")
    .replace(CAN_SELF_HOST_PLACEHOLDER, canSelfHost ? "✅" : "❌")
    .replace(PY_SUPPORT_PLACEHOLDER, pySupport ? "✅" : "❌")
    .replaceAll(API_REF_MODULE_PLACEHOLDER, apiRefModuleUrl)
    .replaceAll(PYTHON_DOC_URL_PLACEHOLDER, pyDocUrl);

  const packageNameShortSnakeCase = fields.packageName.replace(/-/g, "_");
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
