import { z } from "zod";
import { QueryTransformer, TraverseType } from "./parser.js";
import {
  Comparator,
  Comparators,
  Operator,
  Operators,
  StructuredQuery,
} from "./ir.js";
import { Example, InputValues } from "../../schema/index.js";
import {
  DEFAULT_EXAMPLES,
  DEFAULT_PREFIX,
  DEFAULT_SCHEMA,
  DEFAULT_SUFFIX,
  EXAMPLE_PROMPT,
} from "./prompt.js";
import { interpolateFString } from "../../prompts/template.js";
import { LLMChain } from "../llm_chain.js";
import { FewShotPromptTemplate } from "../../prompts/few_shot.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { AsymmetricStructuredOutputParser } from "../../output_parsers/structured.js";
import { AttributeInfo } from "../../schema/query_constructor.js";

export { QueryTransformer, TraverseType };
export {
  DEFAULT_EXAMPLES,
  DEFAULT_PREFIX,
  DEFAULT_SCHEMA,
  DEFAULT_SUFFIX,
  EXAMPLE_PROMPT,
};

const queryInputSchema = /* #__PURE__ */ z.object({
  query: /* #__PURE__ */ z
    .string()
    .describe("text string to compare to document contents"),
  filter: /* #__PURE__ */ z
    .string()
    .optional()
    .describe("logical condition statement for filtering documents"),
});

export class StructuredQueryOutputParser extends AsymmetricStructuredOutputParser<
  typeof queryInputSchema,
  StructuredQuery
> {
  constructor(
    private parserFunction: (
      query: string,
      filter?: string
    ) => Promise<StructuredQuery>
  ) {
    super(queryInputSchema);
  }

  async outputProcessor(
    input: z.infer<typeof queryInputSchema>
  ): Promise<StructuredQuery> {
    return this.parserFunction(input.query, input.filter);
  }

  static fromComponents(
    allowedComparators: Comparator[] = [],
    allowedOperators: Operator[] = []
  ) {
    const queryTransformer = new QueryTransformer(
      allowedComparators,
      allowedOperators
    );
    return new StructuredQueryOutputParser(
      async (query: string, filter?: string) => {
        let myQuery = query;
        if (myQuery.length === 0) {
          myQuery = " ";
        }
        if (filter === "NO_FILTER" || filter === undefined) {
          return new StructuredQuery(query);
        } else {
          const parsedFilter = await queryTransformer.parse(filter);
          return new StructuredQuery(query, parsedFilter);
        }
      }
    );
  }
}

export function formatAttributeInfo(info: AttributeInfo[]) {
  const infoObj = info.reduce((acc, attr) => {
    acc[attr.name] = {
      type: attr.type,
      description: attr.description,
    };
    return acc;
  }, {} as { [name: string]: { type: string; description: string } });

  return JSON.stringify(infoObj, null, 2)
    .replaceAll("{", "{{")
    .replaceAll("}", "}}");
}

const defaultExample = DEFAULT_EXAMPLES.map((EXAMPLE) => EXAMPLE as Example);

function _getPrompt(
  documentContents: string,
  attributeInfo: AttributeInfo[],
  allowedComparators?: Comparator[],
  allowedOperators?: Operator[],
  examples: InputValues[] = defaultExample
) {
  const myAllowedComparators: Comparator[] =
    allowedComparators ?? Object.values(Comparators);
  const myAllowedOperators: Operator[] =
    allowedOperators ?? Object.values(Operators);
  const attributeJSON = formatAttributeInfo(attributeInfo);
  const schema = interpolateFString(DEFAULT_SCHEMA, {
    allowed_comparators: myAllowedComparators.join(" | "),
    allowed_operators: myAllowedOperators.join(" | "),
  });
  const prefix = interpolateFString(DEFAULT_PREFIX, {
    schema,
  });
  const suffix = interpolateFString(DEFAULT_SUFFIX, {
    i: examples.length + 1,
    content: documentContents,
    attributes: attributeJSON,
  });

  const outputParser = StructuredQueryOutputParser.fromComponents(
    allowedComparators,
    allowedOperators
  );

  return new FewShotPromptTemplate({
    examples,
    examplePrompt: EXAMPLE_PROMPT,
    inputVariables: ["query"],
    suffix,
    prefix,
    outputParser,
  });
}

export type QueryConstructorChainOptions = {
  llm: BaseLanguageModel;
  documentContents: string;
  attributeInfo: AttributeInfo[];
  examples?: InputValues[];
  allowedComparators?: Comparator[];
  allowedOperators?: Operator[];
};

export function loadQueryContstructorChain(opts: QueryConstructorChainOptions) {
  const prompt = _getPrompt(
    opts.documentContents,
    opts.attributeInfo,
    opts.allowedComparators,
    opts.allowedOperators,
    opts.examples
  );
  return new LLMChain({
    llm: opts.llm,
    prompt,
  });
}
