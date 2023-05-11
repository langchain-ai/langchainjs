import { Document } from "../../document.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/index.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { BaseOutputParser } from "../../schema/output_parser.js";
import { BaseDocumentCompressor } from "./index.js";
import { PROMPT_TEMPLATE } from "./chain_extract_prompt.js";

function defaultGetInput(
  query: string,
  doc: Document
): Record<string, unknown> {
  return { question: query, context: doc.pageContent };
}

class NoOutputParser extends BaseOutputParser<string> {
  noOutputStr = "NO_OUTPUT";

  parse(text: string): Promise<string> {
    const cleanedText = text.trim();
    if (cleanedText === this.noOutputStr) {
      return Promise.resolve("");
    }
    return Promise.resolve(cleanedText);
  }

  getFormatInstructions(): string {
    throw new Error("Method not implemented.");
  }
}

function getDefaultChainPrompt(): PromptTemplate {
  const outputParser = new NoOutputParser();
  const template = PROMPT_TEMPLATE(outputParser.noOutputStr);
  return new PromptTemplate({
    template,
    inputVariables: ["question", "context"],
    outputParser,
  });
}

export interface LLMChainExtractorArgs {
  llmChain: LLMChain;
  getInput: (query: string, doc: Document) => Record<string, unknown>;
}

export class LLMChainExtractor extends BaseDocumentCompressor {
  llmChain: LLMChain;

  getInput: (query: string, doc: Document) => Record<string, unknown> =
    defaultGetInput;

  constructor({ llmChain, getInput }: LLMChainExtractorArgs) {
    super();
    this.llmChain = llmChain;
    this.getInput = getInput;
  }

  async compressDocuments(
    documents: Document[],
    query: string
  ): Promise<Document[]> {
    const compressedDocs = await Promise.all(
      documents.map(async (doc) => {
        const input = this.getInput(query, doc);
        const output = await this.llmChain.predict(input);
        return output.length > 0
          ? new Document({
              pageContent: output,
              metadata: doc.metadata,
            })
          : undefined;
      })
    );
    return compressedDocs.filter((doc): doc is Document => doc !== undefined);
  }

  static fromLLM(
    llm: BaseLanguageModel,
    prompt?: PromptTemplate,
    getInput?: (query: string, doc: Document) => Record<string, unknown>
  ): LLMChainExtractor {
    const _prompt = prompt || getDefaultChainPrompt();
    const _getInput = getInput || defaultGetInput;
    const llmChain = new LLMChain({ llm, prompt: _prompt });
    return new LLMChainExtractor({ llmChain, getInput: _getInput });
  }
}
