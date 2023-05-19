import * as uuid from "uuid";
import { Document } from "../document.js";

export const getSourceTypeFromDocument = (document: Document): string =>
  document.sourceType ?? document.metadata.sourceType ?? "unknown";

// If we can't find a source name, we can't identify the document, so we generate a random UUID
export const getSourceNameFromDocument = (document: Document): string =>
  document.sourceName ?? document.metadata.sourceName ?? uuid.v4();

export const getUniqueIDFromDocument = (document: Document): string => {
  // We default to 1-1 if we can't find a line number
  let loc = "1-1";
  if (document.metadata.loc) {
    const { lines } = document.metadata.loc;
    loc = `${lines.from}-${lines.to}`;
  }

  const sourceType = getSourceTypeFromDocument(document);
  const sourceName = getSourceNameFromDocument(document);
  return `${sourceType}:${sourceName}:${loc}`;
};
