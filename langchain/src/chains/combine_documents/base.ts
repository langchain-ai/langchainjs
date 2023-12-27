import { Document } from "@langchain/core/documents";
import { BasePromptTemplate, PromptTemplate } from "@langchain/core/prompts";

export const DEFAULT_DOCUMENT_SEPARATOR = "\n\n";

export const DOCUMENTS_KEY = "context";
export const INTERMEDIATE_STEPS_KEY = "intermediate_steps";

export const DEFAULT_DOCUMENT_PROMPT =
  PromptTemplate.fromTemplate("{page_content}");

export function formatDocuments(
  documentPrompt: BasePromptTemplate,
  documentSeparator: string,
  documents: Document[]
) {
  return documents
    .map((document) =>
      documentPrompt.invoke({ page_content: document.pageContent })
    )
    .join(documentSeparator);
}
