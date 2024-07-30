import * as path from "node:path";
import * as fs from "node:fs";

const PACKAGE_NAME_PLACEHOLDER = "__package_name__";
const PACKAGE_NAME_SHORT_SNAKE_CASE_PLACEHOLDER =
  "__package_name_short_snake_case__";
const PACKAGE_NAME_SNAKE_CASE_PLACEHOLDER = "__package_name_snake_case__";
const PACKAGE_NAME_PRETTY_PLACEHOLDER = "__package_name_pretty__";
const MODULE_NAME_PLACEHOLDER = "__ModuleName__";
// This should not be prefixed with `Chat` as it's used for API keys.
const MODULE_NAME_ALL_CAPS_PLACEHOLDER = "__MODULE_NAME_ALL_CAPS__";

const API_REF_BASE_PACKAGE_URL = `https://api.js.langchain.com/modules/langchain_${PACKAGE_NAME_PLACEHOLDER}.html`;
const API_REF_BASE_MODULE_URL = `https://api.js.langchain.com/classes/langchain_${PACKAGE_NAME_PLACEHOLDER}.${MODULE_NAME_PLACEHOLDER}.html`;
const TEMPLATE_PATH = path.resolve("./src/cli/docs/templates/chat.ipynb");
const INTEGRATIONS_DOCS_PATH = path.resolve(
  "../../docs/core_docs/docs/integrations/chat"
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

export async function fillChatIntegrationDocTemplate(fields: {
  packageName: string;
  moduleName: string;
}) {
  const formattedApiRefPackageUrl = API_REF_BASE_PACKAGE_URL.replace(
    PACKAGE_NAME_PLACEHOLDER,
    fields.packageName
  );
  const formattedApiRefModuleUrl = API_REF_BASE_MODULE_URL.replace(
    PACKAGE_NAME_PLACEHOLDER,
    fields.packageName
  ).replace(MODULE_NAME_PLACEHOLDER, fields.moduleName);

  const success = await Promise.all([
    fetchAPIRefUrl(formattedApiRefPackageUrl),
    fetchAPIRefUrl(formattedApiRefModuleUrl),
  ]);
  if (success.some((s) => s === false)) {
    console.error("Invalid package or module name. API reference not found.");
  }

  let docTemplate = await fs.promises.readFile(TEMPLATE_PATH, "utf-8");
  const packageNameShortSnakeCase = fields.packageName.replaceAll("-", "_");
  const fullPackageNameSnakeCase = `langchain_${packageNameShortSnakeCase}`;
  const packageNamePretty = `@langchain/${fields.packageName}`;
  let moduleNameAllCaps = fields.moduleName.toUpperCase();
  if (moduleNameAllCaps.startsWith("CHAT")) {
    moduleNameAllCaps = moduleNameAllCaps.replace("CHAT", "");
  }

  docTemplate = docTemplate.replaceAll(
    PACKAGE_NAME_PLACEHOLDER,
    fields.packageName
  );
  docTemplate = docTemplate.replaceAll(
    PACKAGE_NAME_SNAKE_CASE_PLACEHOLDER,
    fullPackageNameSnakeCase
  );
  docTemplate = docTemplate.replaceAll(
    PACKAGE_NAME_SHORT_SNAKE_CASE_PLACEHOLDER,
    packageNameShortSnakeCase
  );
  docTemplate = docTemplate.replaceAll(
    PACKAGE_NAME_PRETTY_PLACEHOLDER,
    packageNamePretty
  );

  docTemplate = docTemplate.replaceAll(
    MODULE_NAME_PLACEHOLDER,
    fields.moduleName
  );
  docTemplate = docTemplate.replaceAll(
    MODULE_NAME_ALL_CAPS_PLACEHOLDER,
    moduleNameAllCaps
  );

  await fs.promises.writeFile(
    path.join(INTEGRATIONS_DOCS_PATH, `${packageNameShortSnakeCase}.ipynb`),
    docTemplate
  );
}
