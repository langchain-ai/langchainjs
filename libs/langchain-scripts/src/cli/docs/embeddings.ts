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
  LOCAL_PLACEHOLDER,
  PY_SUPPORT_PLACEHOLDER,
  ENV_VAR_NAME_PLACEHOLDER,
  API_REF_MODULE_PLACEHOLDER,
  API_REF_PACKAGE_PLACEHOLDER,
  PYTHON_DOC_URL_PLACEHOLDER,
} from "../constants.js";

const TEMPLATE_PATH = path.resolve(
  "./src/cli/docs/templates/text_embedding.ipynb"
);
const INTEGRATIONS_DOCS_PATH = path.resolve(
  "../../docs/core_docs/docs/integrations/text_embedding"
);

type ExtraFields = {
  local: boolean;
  pySupport: boolean;
  packageName: string;
  fullImportPath?: string;
  envVarName: string;
};

async function promptExtraFields(fields: {
  envVarGuess: string;
}): Promise<ExtraFields> {
  const { envVarGuess } = fields;

  const canRunLocally = await getUserInput(
    "Does this embeddings model support local usage? (y/n) ",
    undefined,
    true
  );
  const hasPySupport = await getUserInput(
    "Does this integration have Python support? (y/n) ",
    undefined,
    true
  );

  const importPath = await getUserInput(
    "What is the full import path of the integration? (e.g @langchain/community/embeddings/togetherai) ",
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
    `Is the environment variable for the API key named ${envVarGuess}? (y/n) `,
    undefined,
    true
  );
  let envVarName = envVarGuess;
  if (isEnvGuessCorrect.toLowerCase() === "n") {
    envVarName = await getUserInput(
      "Please enter the correct environment variable name ",
      undefined,
      true
    );
  }

  return {
    local: canRunLocally.toLowerCase() === "y",
    pySupport: hasPySupport.toLowerCase() === "y",
    packageName,
    fullImportPath: importPath,
    envVarName,
  };
}

export async function fillEmbeddingsIntegrationDocTemplate(fields: {
  className: string;
}) {
  const sidebarLabel = fields.className.replace("Embeddings", "");
  const pyDocUrl = `https://python.langchain.com/docs/integrations/text_embedding/${sidebarLabel.toLowerCase()}/`;
  let envVarName = `${sidebarLabel.toUpperCase()}_API_KEY`;
  const extraFields = await promptExtraFields({
    envVarGuess: envVarName,
  });
  envVarName = extraFields.envVarName;
  const { pySupport } = extraFields;
  const localSupport = extraFields.local;
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
    .replaceAll(LOCAL_PLACEHOLDER, localSupport ? "✅" : "❌")
    .replaceAll(PY_SUPPORT_PLACEHOLDER, pySupport ? "✅" : "❌")
    .replaceAll(ENV_VAR_NAME_PLACEHOLDER, envVarName)
    .replaceAll(API_REF_MODULE_PLACEHOLDER, apiRefModuleUrl)
    .replaceAll(API_REF_PACKAGE_PLACEHOLDER, apiRefPackageUrl)
    .replaceAll(PYTHON_DOC_URL_PLACEHOLDER, pyDocUrl);

  const docFileName = fullImportPath.split("/").pop();
  const docPath = path.join(INTEGRATIONS_DOCS_PATH, `${docFileName}.ipynb`);
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
