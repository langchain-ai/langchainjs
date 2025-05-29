import { z } from "zod";
import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import {
  Example,
  interpolateFString,
  FewShotPromptTemplate,
} from "@langchain/core/prompts";
import {
  InferInteropZodOutput,
  InputValues,
} from "@langchain/core/utils/types";
import { QueryTransformer, TraverseType } from "./parser.js";
import {
  Comparator,
  Comparators,
  Operator,
  Operators,
  StructuredQuery,
} from "./ir.js";
import {
  DEFAULT_EXAMPLES,
  DEFAULT_PREFIX,
  DEFAULT_SCHEMA,
  DEFAULT_SUFFIX,
  EXAMPLE_PROMPT,
} from "./prompt.js";
import { AsymmetricStructuredOutputParser } from "../../output_parsers/structured.js";

/**
 * A simple data structure that holds information about an attribute. It
 * is typically used to provide metadata about attributes in other classes
 * or data structures within the LangChain framework.
 */
export class AttributeInfo {
  constructor(
    public name: string,
    public type: string,
    public description: string
  ) {}
}

export { QueryTransformer, type TraverseType };
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

/**
 * A class that extends AsymmetricStructuredOutputParser to parse
 * structured query output.
 */
export class StructuredQueryOutputParser extends AsymmetricStructuredOutputParser<
  typeof queryInputSchema,
  StructuredQuery
> {
  lc_namespace = ["langchain", "chains", "query_constructor"];

  queryTransformer: QueryTransformer;

  constructor(fields: {
    allowedComparators: Comparator[];
    allowedOperators: Operator[];
  }) {
    super({ ...fields, inputSchema: queryInputSchema });

    const { allowedComparators, allowedOperators } = fields;
    this.queryTransformer = new QueryTransformer(
      allowedComparators,
      allowedOperators
    );
  }

  /**
   * Processes the output of a structured query.
   * @param query The query string.
   * @param filter The filter condition.
   * @returns A Promise that resolves to a StructuredQuery instance.
   */
  async outputProcessor({
    query,
    filter,
  }: InferInteropZodOutput<typeof queryInputSchema>): Promise<StructuredQuery> {
    let myQuery = query;
    if (myQuery.length === 0) {
      myQuery = " ";
    }
    if (filter === "NO_FILTER" || filter === undefined) {
      return new StructuredQuery(query);
    } else {
      const parsedFilter = await this.queryTransformer.parse(filter);
      return new StructuredQuery(query, parsedFilter);
    }
  }

  /**
   * Creates a new StructuredQueryOutputParser instance from the provided
   * components.
   * @param allowedComparators An array of allowed Comparator instances.
   * @param allowedOperators An array of allowed Operator instances.
   * @returns A new StructuredQueryOutputParser instance.
   */
  static fromComponents(
    allowedComparators: Comparator[] = [],
    allowedOperators: Operator[] = []
  ) {
    return new StructuredQueryOutputParser({
      allowedComparators,
      allowedOperators,
    });
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

/**
 * A type that represents options for the query constructor chain.
 */
export type QueryConstructorRunnableOptions = {
  llm: BaseLanguageModelInterface;
  documentContents: string;
  attributeInfo: AttributeInfo[];
  examples?: InputValues[];
  allowedComparators?: Comparator[];
  allowedOperators?: Operator[];
};

/** @deprecated */
export type QueryConstructorChainOptions = QueryConstructorRunnableOptions;

export function loadQueryConstructorRunnable(
  opts: QueryConstructorRunnableOptions
) {
  const prompt = _getPrompt(
    opts.documentContents,
    opts.attributeInfo,
    opts.allowedComparators,
    opts.allowedOperators,
    opts.examples
  );
  const outputParser = StructuredQueryOutputParser.fromComponents(
    opts.allowedComparators,
    opts.allowedOperators
  );
  return prompt.pipe(opts.llm).pipe(outputParser);
}
