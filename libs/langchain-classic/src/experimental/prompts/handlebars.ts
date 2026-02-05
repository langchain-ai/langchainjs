import Handlebars from "handlebars";
import { type ParsedFStringNode } from "@langchain/core/prompts";
import type { InputValues } from "@langchain/core/utils/types";
import {
  CustomFormatPromptTemplate,
  CustomFormatPromptTemplateInput,
} from "./custom_format.js";

export const parseHandlebars = (template: string): ParsedFStringNode[] => {
  const parsed: ParsedFStringNode[] = [];
  const nodes: { type: string }[] = [...Handlebars.parse(template).body];
  while (nodes.length) {
    const node = nodes.pop()!;
    if (node.type === "ContentStatement") {
      // @ts-expect-error - handlebars' hbs.AST.ContentStatement isn't exported
      const text = node.value;
      parsed.push({ type: "literal", text });
    } else if (node.type === "MustacheStatement") {
      // @ts-expect-error - handlebars' hbs.AST.MustacheStatement isn't exported
      const name: string = node.path.parts[0];
      // @ts-expect-error - handlebars' hbs.AST.MustacheStatement isn't exported
      const { original } = node.path as { original: string };
      if (
        !!name &&
        !original.startsWith("this.") &&
        !original.startsWith("@")
      ) {
        parsed.push({ type: "variable", name });
      }
    } else if (node.type === "PathExpression") {
      // @ts-expect-error - handlebars' hbs.AST.PathExpression isn't exported
      const name: string = node.parts[0];
      // @ts-expect-error - handlebars' hbs.AST.PathExpression isn't exported
      const { original } = node;
      if (
        !!name &&
        !original.startsWith("this.") &&
        !original.startsWith("@")
      ) {
        parsed.push({ type: "variable", name });
      }
    } else if (node.type === "BlockStatement") {
      // @ts-expect-error - handlebars' hbs.AST.BlockStatement isn't exported
      nodes.push(...node.params, ...node.program.body);
    }
  }

  return parsed;
};

export const interpolateHandlebars = (
  template: string,
  values: InputValues
) => {
  const compiled = Handlebars.compile(template, { noEscape: true });
  return compiled(values);
};

export type HandlebarsPromptTemplateInput<RunInput extends InputValues> =
  CustomFormatPromptTemplateInput<RunInput>;

export class HandlebarsPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
> extends CustomFormatPromptTemplate<RunInput> {
  static lc_name() {
    return "HandlebarsPromptTemplate";
  }

  /**
   * Load prompt template from a template
   */
  static fromTemplate<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends InputValues = Record<string, any>,
  >(
    template: string,
    params?: Omit<
      HandlebarsPromptTemplateInput<RunInput>,
      | "template"
      | "inputVariables"
      | "customParser"
      | "templateValidator"
      | "renderer"
    >
  ) {
    return super.fromTemplate<RunInput>(template, {
      ...params,
      validateTemplate: false,
      customParser: parseHandlebars,
      renderer: interpolateHandlebars,
    });
  }
}
