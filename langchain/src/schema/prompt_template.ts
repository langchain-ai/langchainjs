import { Document } from "../document.js";
import { BasePromptTemplate } from "../prompts/base.js";

export const formatDocument = async (
  document: Document,
  prompt: BasePromptTemplate
): Promise<string> => {
  const baseInfo = {
    pageContent: document.pageContent,
    ...document.metadata,
  };
  const variables = new Set(prompt.inputVariables);
  const requiredMetadata = new Set(
    prompt.inputVariables
      .map((v) => (v !== "pageContent" ? v : null))
      .filter((v) => v !== null)
  );
  const missingMetadata = [];
  for (const variable of variables) {
    if (!(variable in baseInfo) && variable !== "pageContent") {
      missingMetadata.push(variable);
    }
  }
  if (missingMetadata.length) {
    throw new Error(
      `Document prompt requires documents to have metadata variables: ${JSON.stringify(requiredMetadata)}. Received document with missing metadata: ${JSON.stringify(missingMetadata)}`
    );
  }
  return prompt.format(baseInfo);
};
