import path from "path";
import fs from "fs";
import * as yaml from "yaml";

import { BasePromptTemplate } from ".";
import { loadFromHub } from "../util/hub";

export const resolveTemplate = (
  fieldName: string,
  template?: string,
  templatePath?: string
) => {
  if (templatePath !== undefined && template !== undefined) {
    throw new Error(
      `Both '${fieldName}_path' and '${fieldName}' cannot be provided.`
    );
  }

  if (template !== undefined) {
    return template;
  }

  if (templatePath !== undefined) {
    if (path.extname(templatePath) !== ".txt") {
      throw new Error("Invalid file type");
    }

    return fs.readFileSync(templatePath).toString();
  }

  throw new Error(
    `One of '${fieldName}_path' and '${fieldName}' must be provided.`
  );
};

const loadPromptFromFile = async (
  file: string
): Promise<BasePromptTemplate> => {
  const suffix = path.extname(file);
  let config;

  if (suffix === ".json") {
    const data = fs.readFileSync(file);
    config = JSON.parse(data.toString());
  } else if (suffix === ".yaml") {
    const data = fs.readFileSync(file);
    const str = data.toString();
    config = yaml.parse(str);
  } else if (suffix === ".py") {
    throw new Error(
      "Could not load spec. Loading python resources not yet supported."
    );
  } else {
    throw new Error(`Got unsupported file type ${suffix}`);
  }
  return BasePromptTemplate.deserialize(config);
};

export const loadPrompt = async (uri: string): Promise<BasePromptTemplate> => {
  const hubResult = await loadFromHub(
    uri,
    loadPromptFromFile,
    "prompts",
    new Set(["py", "json", "yaml"])
  );
  if (hubResult) {
    return hubResult;
  }

  return loadPromptFromFile(uri);
};
