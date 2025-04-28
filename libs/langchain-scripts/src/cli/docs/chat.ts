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
  ENV_VAR_NAME_PLACEHOLDER,
  API_REF_MODULE_PLACEHOLDER,
  API_REF_PACKAGE_PLACEHOLDER,
  PYTHON_DOC_URL_PLACEHOLDER,
  LOCAL_PLACEHOLDER,
  SERIALIZABLE_PLACEHOLDER,
  PY_SUPPORT_PLACEHOLDER,
} from "../constants.js";

const TOOL_CALLING_PLACEHOLDER = "__tool_calling__";
const JSON_MODE_PLACEHOLDER = "__json_mode__";
const IMAGE_INPUT_PLACEHOLDER = "__image_input__";
const AUDIO_INPUT_PLACEHOLDER = "__audio_input__";
const VIDEO_INPUT_PLACEHOLDER = "__video_input__";
const TOKEN_LEVEL_STREAMING_PLACEHOLDER = "__token_level_streaming__";
const TOKEN_USAGE_PLACEHOLDER = "__token_usage__";
const LOGPROBS_PLACEHOLDER = "__logprobs__";

const TEMPLATE_PATH = path.resolve("./src/cli/docs/templates/chat.ipynb");
const INTEGRATIONS_DOCS_PATH = path.resolve(
  "../../docs/core_docs/docs/integrations/chat"
);

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
  envVarName: string;
  fullImportPath: string;
  packageName: string;
};

async function promptExtraFields(fields: {
  envVarGuess: string;
}): Promise<ExtraFields> {
  const hasToolCalling = await getUserInput(
    "Does this integration support tool calling? (y/n) ",
    undefined,
    true
  );
  const hasJsonMode = await getUserInput(
    "Does this integration support JSON mode? (y/n) ",
    undefined,
    true
  );
  const hasImageInput = await getUserInput(
    "Does this integration support image input? (y/n) ",
    undefined,
    true
  );
  const hasAudioInput = await getUserInput(
    "Does this integration support audio input? (y/n) ",
    undefined,
    true
  );
  const hasVideoInput = await getUserInput(
    "Does this integration support video input? (y/n) ",
    undefined,
    true
  );
  const hasTokenLevelStreaming = await getUserInput(
    "Does this integration support token level streaming? (y/n) ",
    undefined,
    true
  );
  const hasTokenUsage = await getUserInput(
    "Does this integration support token usage? (y/n) ",
    undefined,
    true
  );
  const hasLogprobs = await getUserInput(
    "Does this integration support logprobs? (y/n) ",
    undefined,
    true
  );
  const hasLocal = await getUserInput(
    "Does this integration support local usage? (y/n) ",
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

  const importPath = await getUserInput(
    "What is the full import path of the integration? (e.g @langchain/community/chat_models/togetherai) ",
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
    envVarName,
    fullImportPath: importPath,
    packageName,
  };
}

export async function fillChatIntegrationDocTemplate(fields: {
  className: string;
}) {
  const sidebarLabel = fields.className.replace("Chat", "");
  const pyDocUrl = `https://python.langchain.com/docs/integrations/chat/${sidebarLabel.toLowerCase()}/`;
  let envVarName = `${sidebarLabel.toUpperCase()}_API_KEY`;
  const extraFields = await promptExtraFields({
    envVarGuess: envVarName,
  });
  envVarName = extraFields.envVarName;

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
    .replaceAll(ENV_VAR_NAME_PLACEHOLDER, extraFields.envVarName)
    .replaceAll(API_REF_MODULE_PLACEHOLDER, apiRefModuleUrl)
    .replaceAll(API_REF_PACKAGE_PLACEHOLDER, apiRefPackageUrl)
    .replaceAll(PYTHON_DOC_URL_PLACEHOLDER, pyDocUrl)
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

  const docFileName = extraFields.fullImportPath.split("/").pop();
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
