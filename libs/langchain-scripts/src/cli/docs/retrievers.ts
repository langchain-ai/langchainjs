import * as path from "node:path";
import * as fs from "node:fs";
import {
  boldText,
  getUserInput,
  greenText,
  redBackground,
} from "../utils/get-input.js";
import { fetchURLStatus } from "../utils/fetch-url-status.js";
import {
  PACKAGE_NAME_PLACEHOLDER,
  MODULE_NAME_PLACEHOLDER,
  SIDEBAR_LABEL_PLACEHOLDER,
  FULL_IMPORT_PATH_PLACEHOLDER,
  PY_SUPPORT_PLACEHOLDER,
  API_REF_MODULE_PLACEHOLDER,
  PYTHON_DOC_URL_PLACEHOLDER,
} from "../constants.js";

const HAS_CLOUD_OFFERING_PLACEHOLDER = "__has_cloud_offering__";
const CAN_SELF_HOST_PLACEHOLDER = "__can_self_host__";

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

async function promptExtraFields(): Promise<ExtraFields> {
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

  const importPath = await getUserInput(
    "What is the full import path of the integration? (e.g @langchain/community/retrievers/my_retriever) ",
    undefined,
    true
  );

  let packageName = "";
  if (importPath.startsWith("langchain/")) {
    packageName = "langchain";
  } else {
    packageName = importPath.split("/").slice(0, 2).join("/");
  }

  const verifyPackageName = await getUserInput(
    `Is ${packageName} the correct package name? (y/n) `,
    undefined,
    true
  );
  if (verifyPackageName.toLowerCase() === "n") {
    packageName = await getUserInput(
      "Please enter the full package name (e.g @langchain/community) ",
      undefined,
      true
    );
  }

  return {
    packageName,
    fullImportPath: importPath,
    canSelfHost: canSelfHost.toLowerCase() === "y",
    hasCloudOffering: hasCloudOffering.toLowerCase() === "y",
    pySupport: hasPySupport.toLowerCase() === "y",
  };
}

export async function fillRetrieverIntegrationDocTemplate(fields: {
  className: string;
}) {
  const sidebarLabel = fields.className.replace("Retriever", "");
  const pyDocUrl = `https://python.langchain.com/docs/integrations/retrievers/${sidebarLabel.toLowerCase()}/`;
  const extraFields = await promptExtraFields();
  const { pySupport } = extraFields;
  const { canSelfHost } = extraFields;
  const { hasCloudOffering } = extraFields;
  const { packageName } = extraFields;
  const fullImportPath = extraFields.fullImportPath ?? extraFields.packageName;

  const apiRefModuleUrl = `https://api.js.langchain.com/classes/${fullImportPath
    .replace("@", "")
    .replaceAll("/", "_")
    .replaceAll("-", "_")}.${fields.className}.html`;
  const apiRefPackageUrl = apiRefModuleUrl
    .replace("/classes/", "/modules/")
    .replace(`.${fields.className}.html`, ".html");

  const apiRefUrlSuccesses = await Promise.all([
    fetchURLStatus(apiRefModuleUrl),
    fetchURLStatus(apiRefPackageUrl),
  ]);
  if (apiRefUrlSuccesses.find((s) => !s)) {
    console.warn(
      "API ref URLs invalid. Please manually ensure they are correct."
    );
  }

  const docTemplate = (await fs.promises.readFile(TEMPLATE_PATH, "utf-8"))
    .replaceAll(PACKAGE_NAME_PLACEHOLDER, packageName)
    .replaceAll(MODULE_NAME_PLACEHOLDER, fields.className)
    .replaceAll(SIDEBAR_LABEL_PLACEHOLDER, sidebarLabel)
    .replaceAll(FULL_IMPORT_PATH_PLACEHOLDER, fullImportPath)
    .replace(HAS_CLOUD_OFFERING_PLACEHOLDER, hasCloudOffering ? "✅" : "❌")
    .replace(CAN_SELF_HOST_PLACEHOLDER, canSelfHost ? "✅" : "❌")
    .replace(PY_SUPPORT_PLACEHOLDER, pySupport ? "✅" : "❌")
    .replaceAll(API_REF_MODULE_PLACEHOLDER, apiRefModuleUrl)
    .replaceAll(PYTHON_DOC_URL_PLACEHOLDER, pyDocUrl);

  const packageNameShortSnakeCase = fields.className
    .replace(/-/g, "_")
    .toLowerCase();
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
