import { LanguageModelLike } from "@langchain/core/language_models/base";
import {
  BaseOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { BasePromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnablePick,
  RunnableSequence,
} from "@langchain/core/runnables";

import {
  DEFAULT_DOCUMENT_PROMPT,
  DEFAULT_DOCUMENT_SEPARATOR,
  DOCUMENTS_KEY,
  formatDocuments,
} from "./base.js";

/**
 * Create a chain that passes a list of documents to a model.
 * 
 * @param llm Language model to use for responding.
 * @param prompt Prompt template. Must contain input variable "context", which will be
    used for passing in the formatted documents.
 * @param outputParser Output parser. Defaults to `StringOutputParser`.
 * @param documentPrompt Prompt used for formatting each document into a string. Input
    variables can be "page_content" or any metadata keys that are in all documents.
    "page_content" will automatically retrieve the `Document.page_content`, and all 
    other inputs variables will be automatically retrieved from the `Document.metadata` dictionary. Default to a prompt that only contains `Document.page_content`.
 * @param documentSeparator String separator to use between formatted document strings.
 * @returns An LCEL `Runnable` chain.
    Expects a dictionary as input with a list of `Document`s being passed under
    the "context" key.
    Return type depends on the `output_parser` used.
 */
export async function createStuffDocumentsChain<RunOutput = string>({
  llm,
  prompt,
  outputParser = new StringOutputParser() as unknown as BaseOutputParser<RunOutput>,
  documentPrompt = DEFAULT_DOCUMENT_PROMPT,
  documentSeparator = DEFAULT_DOCUMENT_SEPARATOR,
}: {
  llm: LanguageModelLike;
  prompt: BasePromptTemplate;
  outputParser?: BaseOutputParser<RunOutput>;
  documentPrompt?: BasePromptTemplate;
  documentSeparator?: string;
}) {
  if (!prompt.inputVariables.includes(DOCUMENTS_KEY)) {
    throw new Error(`Prompt must include a "${DOCUMENTS_KEY}" variable`);
  }

  return RunnableSequence.from(
    [
      RunnablePassthrough.assign({
        [DOCUMENTS_KEY]: new RunnablePick(DOCUMENTS_KEY).pipe(
          (documents, metadata) =>
            formatDocuments({
              documents,
              documentPrompt,
              documentSeparator,
              config: metadata?.config,
            })
        ),
      }),
      prompt,
      llm,
      outputParser,
    ],
    "stuff_documents_chain"
  );
}
