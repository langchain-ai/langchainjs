import * as path from "node:path";
import * as fs from "node:fs";
import { boldText, getUserInput, greenText } from "../utils/get-input.js";
import { fetchURLStatus } from "../utils/fetch-url-status.js";
import {
  SIDEBAR_LABEL_PLACEHOLDER,
  MODULE_NAME_PLACEHOLDER,
  PACKAGE_NAME_PLACEHOLDER,
  FULL_IMPORT_PATH_PLACEHOLDER,
  ENV_VAR_NAME_PLACEHOLDER,
  PYTHON_DOC_URL_PLACEHOLDER,
  API_REF_MODULE_PLACEHOLDER,
  API_REF_PACKAGE_PLACEHOLDER,
} from "../constants.js";

const TEMPLATE_PATH = path.resolve(
  "./src/cli/docs/templates/vectorstores.ipynb"
);
const INTEGRATIONS_DOCS_PATH = path.resolve(
  "../../docs/core_docs/docs/integrations/vectorstores"
);

type ExtraFields = {
  envVarName: string;
  fullImportPath: string;
  packageName: string;
};

async function promptExtraFields(fields: {
  envVarGuess: string;
}): Promise<ExtraFields> {
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

  const isEnvGuessCorrect = await getUserInput(
    `Is the environment variable for the API key named ${fields.envVarGuess}? (y/n) `,
    undefined,
    true
  );
  let envVarName = fields.envVarGuess;
  if (isEnvGuessCorrect.toLowerCase() === "n") {
    envVarName = await getUserInput(
      "Please enter the correct environment variable name ",
      undefined,
      true
    );
  }

  return {
    envVarName,
    fullImportPath: importPath,
    packageName,
  };
}

export async function fillVectorStoreIntegrationDocTemplate(fields: {
  className: string;
}) {
  const sidebarLabel = fields.className.replace("VectorStore", "");
  const pyDocUrl = `https://python.langchain.com/v0.2/docs/integrations/vectorstores/${sidebarLabel.toLowerCase()}/`;
  let envVarName = `${sidebarLabel.toUpperCase()}_API_KEY`;
  const extraFields = await promptExtraFields({
    envVarGuess: envVarName,
  });
  envVarName = extraFields.envVarName;
  const importPathEnding = extraFields.fullImportPath.split("/").pop() ?? "";
  const apiRefModuleUrl = `https://api.js.langchain.com/classes/${extraFields.fullImportPath
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
    .replaceAll(SIDEBAR_LABEL_PLACEHOLDER, sidebarLabel)
    .replaceAll(MODULE_NAME_PLACEHOLDER, fields.className)
    .replaceAll(PACKAGE_NAME_PLACEHOLDER, extraFields.packageName)
    .replaceAll(FULL_IMPORT_PATH_PLACEHOLDER, extraFields.fullImportPath)
    .replaceAll(ENV_VAR_NAME_PLACEHOLDER, envVarName)
    .replaceAll(PYTHON_DOC_URL_PLACEHOLDER, pyDocUrl)
    .replaceAll(API_REF_MODULE_PLACEHOLDER, apiRefModuleUrl)
    .replaceAll(API_REF_PACKAGE_PLACEHOLDER, apiRefPackageUrl);

  const docPath = path.join(
    INTEGRATIONS_DOCS_PATH,
    `${importPathEnding}.ipynb`
  );
  await fs.promises.writeFile(docPath, docTemplate);
  const prettyDocPath = docPath.split("docs/core_docs/")[1];

  console.log(
    `${greenText(
      `\nSuccessfully created new document loader integration doc at ${prettyDocPath}.`
    )}\n
${boldText("Next steps:")}
  - Run all code cells in the generated doc to record the outputs.
  - Add extra sections on integration specific features.\n`
  );
}
