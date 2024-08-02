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
const PY_SUPPORT_PLACEHOLDER = "__py_support__";
const HAS_CLOUD_OFFERING_PLACEHOLDER = "__has_cloud_offering__";
const CAN_SELF_HOST_PLACEHOLDER = "__can_self_host__";

const TEMPLATE_PATH = path.resolve("./src/cli/docs/templates/retrievers.ipynb");
const INTEGRATIONS_DOCS_PATH = path.resolve(
  "../../docs/core_docs/docs/integrations/retrievers"
);


type ExtraFields = {
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

  return {
    canSelfHost: canSelfHost.toLowerCase() === "y",
    hasCloudOffering: hasCloudOffering.toLowerCase() === "y",
    pySupport: hasPySupport.toLowerCase() === "y",
  };
}

export async function fillRetrieverIntegrationDocTemplate(fields: {
  packageName: string;
  moduleName: string;
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

  const docTemplate = (await fs.promises.readFile(TEMPLATE_PATH, "utf-8"))
    .replaceAll(PACKAGE_NAME_PLACEHOLDER, fields.packageName)
    .replaceAll(MODULE_NAME_PLACEHOLDER, fields.moduleName)
    .replace(HAS_CLOUD_OFFERING_PLACEHOLDER, extraFields?.hasCloudOffering ? "✅" : "❌")
    .replace(CAN_SELF_HOST_PLACEHOLDER, extraFields?.canSelfHost ? "✅" : "❌")
    .replace(PY_SUPPORT_PLACEHOLDER, extraFields?.pySupport ? "✅" : "❌");

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
