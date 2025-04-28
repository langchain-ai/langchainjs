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
  SIDEBAR_LABEL_PLACEHOLDER,
  MODULE_NAME_PLACEHOLDER,
  PACKAGE_NAME_PLACEHOLDER,
  FULL_IMPORT_PATH_PLACEHOLDER,
  PYTHON_DOC_URL_PLACEHOLDER,
  API_REF_MODULE_PLACEHOLDER,
  PY_SUPPORT_PLACEHOLDER,
} from "../constants.js";

const TEMPLATE_PATH = path.resolve("./src/cli/docs/templates/toolkits.ipynb");
const INTEGRATIONS_DOCS_PATH = path.resolve(
  "../../docs/core_docs/docs/integrations/toolkits"
);

type ExtraFields = {
  pySupport: boolean;
  fullImportPath: string;
  packageName: string;
};

async function promptExtraFields(): Promise<ExtraFields> {
  const hasPySupport = await getUserInput(
    "Does this integration have Python support? (y/n) ",
    undefined,
    true
  );
  const importPath = await getUserInput(
    "What is the full import path of the integration? (e.g @langchain/community/llms/togetherai) ",
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
    pySupport: hasPySupport.toLowerCase() === "y",
    fullImportPath: importPath,
    packageName,
  };
}

export async function fillToolkitIntegrationDocTemplate(fields: {
  className: string;
}) {
  const sidebarLabel = fields.className.replace("Toolkit", "");
  const pyDocUrl = `https://python.langchain.com/docs/integrations/toolkits/${sidebarLabel.toLowerCase()}/`;
  const extraFields = await promptExtraFields();
  const importPathEnding = extraFields.fullImportPath.split("/").pop() ?? "";
  const apiRefModuleUrl = `https://api.js.langchain.com/classes/${extraFields.fullImportPath
    .replace("@", "")
    .replaceAll("/", "_")
    .replaceAll("-", "_")}.${fields.className}.html`;

  const apiRefUrlSuccess = await fetchURLStatus(apiRefModuleUrl);
  if (apiRefUrlSuccess === false) {
    console.warn(
      "API ref URL is invalid. Please manually ensure it is correct."
    );
  }

  const docTemplate = (await fs.promises.readFile(TEMPLATE_PATH, "utf-8"))
    .replaceAll(SIDEBAR_LABEL_PLACEHOLDER, sidebarLabel)
    .replaceAll(MODULE_NAME_PLACEHOLDER, fields.className)
    .replaceAll(PACKAGE_NAME_PLACEHOLDER, extraFields.packageName)
    .replaceAll(FULL_IMPORT_PATH_PLACEHOLDER, extraFields.fullImportPath)
    .replaceAll(PYTHON_DOC_URL_PLACEHOLDER, pyDocUrl)
    .replaceAll(API_REF_MODULE_PLACEHOLDER, apiRefModuleUrl)
    .replaceAll(PY_SUPPORT_PLACEHOLDER, extraFields?.pySupport ? "✅" : "❌");

  const docPath = path.join(
    INTEGRATIONS_DOCS_PATH,
    `${importPathEnding}.ipynb`
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
