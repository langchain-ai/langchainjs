import * as path from "node:path";
import * as fs from "node:fs";
import {
  boldText,
  getUserInput,
  greenText,
  redBackground,
} from "../utils/get-input.js";

const PACKAGE_NAME_PLACEHOLDER = "__package_name__";
const PACKAGE_NAME_SHORT_SNAKE_CASE_PLACEHOLDER =
  "__package_name_short_snake_case__";
const PACKAGE_NAME_SNAKE_CASE_PLACEHOLDER = "__package_name_snake_case__";
const PACKAGE_NAME_PRETTY_PLACEHOLDER = "__package_name_pretty__";
const MODULE_NAME_PLACEHOLDER = "__ModuleName__";
// This should not be prefixed with `Chat` as it's used for API keys.
const MODULE_NAME_ALL_CAPS_PLACEHOLDER = "__MODULE_NAME_ALL_CAPS__";

const TOOL_CALLING_PLACEHOLDER = "__tool_calling__";
const JSON_MODE_PLACEHOLDER = "__json_mode__";
const IMAGE_INPUT_PLACEHOLDER = "__image_input__";
const AUDIO_INPUT_PLACEHOLDER = "__audio_input__";
const VIDEO_INPUT_PLACEHOLDER = "__video_input__";
const TOKEN_LEVEL_STREAMING_PLACEHOLDER = "__token_level_streaming__";
const TOKEN_USAGE_PLACEHOLDER = "__token_usage__";
const LOGPROBS_PLACEHOLDER = "__logprobs__";

const SERIALIZABLE_PLACEHOLDER = "__serializable__";
const LOCAL_PLACEHOLDER = "__local__";
const PY_SUPPORT_PLACEHOLDER = "__py_support__";

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

type ExtraFields = {
  /**
   * If tool calling is true, structured output will also be true.
   */
  toolCalling: boolean;
  jsonMode: boolean;
  imageInput: boolean;
  audioInput: boolean;
  videoInput: boolean;
  tokenLevelStreaming: boolean;
  tokenUsage: boolean;
  logprobs: boolean;
  local: boolean;
  serializable: boolean;
  pySupport: boolean;
};

async function promptExtraFields(): Promise<ExtraFields> {
  const hasToolCalling = await getUserInput(
    "Does the tool support tool calling? (y/n) ",
    undefined,
    true
  );
  const hasJsonMode = await getUserInput(
    "Does the tool support JSON mode? (y/n) ",
    undefined,
    true
  );
  const hasImageInput = await getUserInput(
    "Does the tool support image input? (y/n) ",
    undefined,
    true
  );
  const hasAudioInput = await getUserInput(
    "Does the tool support audio input? (y/n) ",
    undefined,
    true
  );
  const hasVideoInput = await getUserInput(
    "Does the tool support video input? (y/n) ",
    undefined,
    true
  );
  const hasTokenLevelStreaming = await getUserInput(
    "Does the tool support token level streaming? (y/n) ",
    undefined,
    true
  );
  const hasTokenUsage = await getUserInput(
    "Does the tool support token usage? (y/n) ",
    undefined,
    true
  );
  const hasLogprobs = await getUserInput(
    "Does the tool support logprobs? (y/n) ",
    undefined,
    true
  );
  const hasLocal = await getUserInput(
    "Does the tool support local usage? (y/n) ",
    undefined,
    true
  );
  const hasSerializable = await getUserInput(
    "Does the tool support serializable output? (y/n) ",
    undefined,
    true
  );
  const hasPySupport = await getUserInput(
    "Does the tool support Python support? (y/n) ",
    undefined,
    true
  );

  return {
    toolCalling: hasToolCalling.toLowerCase() === "y",
    jsonMode: hasJsonMode.toLowerCase() === "y",
    imageInput: hasImageInput.toLowerCase() === "y",
    audioInput: hasAudioInput.toLowerCase() === "y",
    videoInput: hasVideoInput.toLowerCase() === "y",
    tokenLevelStreaming: hasTokenLevelStreaming.toLowerCase() === "y",
    tokenUsage: hasTokenUsage.toLowerCase() === "y",
    logprobs: hasLogprobs.toLowerCase() === "y",
    local: hasLocal.toLowerCase() === "y",
    serializable: hasSerializable.toLowerCase() === "y",
    pySupport: hasPySupport.toLowerCase() === "y",
  };
}

export async function fillChatIntegrationDocTemplate(fields: {
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
    // Don't error out because this might be used before the package is released.
    console.error("Invalid package or module name. API reference not found.");
  }

  const packageNameShortSnakeCase = fields.packageName.replaceAll("-", "_");
  const fullPackageNameSnakeCase = `langchain_${packageNameShortSnakeCase}`;
  const packageNamePretty = `@langchain/${fields.packageName}`;
  let moduleNameAllCaps = fields.moduleName.toUpperCase();
  if (moduleNameAllCaps.startsWith("CHAT")) {
    moduleNameAllCaps = moduleNameAllCaps.replace("CHAT", "");
  }

  const docTemplate = (await fs.promises.readFile(TEMPLATE_PATH, "utf-8"))
    .replaceAll(PACKAGE_NAME_PLACEHOLDER, fields.packageName)
    .replaceAll(PACKAGE_NAME_SNAKE_CASE_PLACEHOLDER, fullPackageNameSnakeCase)
    .replaceAll(
      PACKAGE_NAME_SHORT_SNAKE_CASE_PLACEHOLDER,
      packageNameShortSnakeCase
    )
    .replaceAll(PACKAGE_NAME_PRETTY_PLACEHOLDER, packageNamePretty)
    .replaceAll(MODULE_NAME_PLACEHOLDER, fields.moduleName)
    .replaceAll(MODULE_NAME_ALL_CAPS_PLACEHOLDER, moduleNameAllCaps)
    .replaceAll(
      TOOL_CALLING_PLACEHOLDER,
      extraFields?.toolCalling ? "✅" : "❌"
    )
    .replace(JSON_MODE_PLACEHOLDER, extraFields?.jsonMode ? "✅" : "❌")
    .replace(IMAGE_INPUT_PLACEHOLDER, extraFields?.imageInput ? "✅" : "❌")
    .replace(AUDIO_INPUT_PLACEHOLDER, extraFields?.audioInput ? "✅" : "❌")
    .replace(VIDEO_INPUT_PLACEHOLDER, extraFields?.videoInput ? "✅" : "❌")
    .replace(
      TOKEN_LEVEL_STREAMING_PLACEHOLDER,
      extraFields?.tokenLevelStreaming ? "✅" : "❌"
    )
    .replace(TOKEN_USAGE_PLACEHOLDER, extraFields?.tokenUsage ? "✅" : "❌")
    .replace(LOGPROBS_PLACEHOLDER, extraFields?.logprobs ? "✅" : "❌")
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
