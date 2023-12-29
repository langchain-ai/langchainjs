import { Document } from "@langchain/core/documents";
import { BasePromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { RunnableConfig } from "@langchain/core/runnables";

export const DEFAULT_DOCUMENT_SEPARATOR = "\n\n";

export const DOCUMENTS_KEY = "context";
export const INTERMEDIATE_STEPS_KEY = "intermediate_steps";

export const DEFAULT_DOCUMENT_PROMPT =
  /* #__PURE__ */ PromptTemplate.fromTemplate("{page_content}");

export async function formatDocuments({
  documentPrompt,
  documentSeparator,
  documents,
  config,
}: {
  documentPrompt: BasePromptTemplate;
  documentSeparator: string;
  documents: Document[];
  config?: RunnableConfig;
}) {
  const formattedDocs = await Promise.all(
    documents.map((document) =>
      documentPrompt
        .withConfig({ runName: "document_formatter" })
        .invoke({ page_content: document.pageContent }, config)
    )
  );
  return formattedDocs.join(documentSeparator);
}
