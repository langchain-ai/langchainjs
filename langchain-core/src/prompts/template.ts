import mustache from "mustache";
import { MessageContent } from "../messages/index.js";
import type { InputValues } from "../utils/types/index.js";

function configureMustache() {
  // Use unescaped HTML
  // https://github.com/janl/mustache.js?tab=readme-ov-file#variables
  mustache.escape = (text) => text;
}

/**
 * Type that specifies the format of a template.
 */
export type TemplateFormat = "f-string" | "mustache";

/**
 * Type that represents a node in a parsed format string. It can be either
 * a literal text or a variable name.
 */
export type ParsedTemplateNode =
  | { type: "literal"; text: string }
  | { type: "variable"; name: string };

/**
 * Alias for `ParsedTemplateNode` since it is the same for
 * both f-string and mustache templates.
 */
export type ParsedFStringNode = ParsedTemplateNode;

export const parseFString = (template: string): ParsedTemplateNode[] => {
  // Core logic replicated from internals of pythons built in Formatter class.
  // https://github.com/python/cpython/blob/135ec7cefbaffd516b77362ad2b2ad1025af462e/Objects/stringlib/unicode_format.h#L700-L706
  const chars = template.split("");
  const nodes: ParsedTemplateNode[] = [];

  const nextBracket = (bracket: "}" | "{" | "{}", start: number) => {
    for (let i = start; i < chars.length; i += 1) {
      if (bracket.includes(chars[i])) {
        return i;
      }
    }
    return -1;
  };

  let i = 0;
  while (i < chars.length) {
    if (chars[i] === "{" && i + 1 < chars.length && chars[i + 1] === "{") {
      nodes.push({ type: "literal", text: "{" });
      i += 2;
    } else if (
      chars[i] === "}" &&
      i + 1 < chars.length &&
      chars[i + 1] === "}"
    ) {
      nodes.push({ type: "literal", text: "}" });
      i += 2;
    } else if (chars[i] === "{") {
      const j = nextBracket("}", i);
      if (j < 0) {
        throw new Error("Unclosed '{' in template.");
      }

      nodes.push({
        type: "variable",
        name: chars.slice(i + 1, j).join(""),
      });
      i = j + 1;
    } else if (chars[i] === "}") {
      throw new Error("Single '}' in template.");
    } else {
      const next = nextBracket("{}", i);
      const text = (next < 0 ? chars.slice(i) : chars.slice(i, next)).join("");
      nodes.push({ type: "literal", text });
      i = next < 0 ? chars.length : next;
    }
  }
  return nodes;
};

/**
 * Convert the result of mustache.parse into an array of ParsedTemplateNode,
 * to make it compatible with other LangChain string parsing template formats.
 *
 * @param {mustache.TemplateSpans} template The result of parsing a mustache template with the mustache.js library.
 * @returns {ParsedTemplateNode[]}
 */
const mustacheTemplateToNodes = (
  template: mustache.TemplateSpans
): ParsedTemplateNode[] =>
  template.map((temp) => {
    if (temp[0] === "name") {
      const name = temp[1].includes(".") ? temp[1].split(".")[0] : temp[1];
      return { type: "variable", name };
    } else if (["#", "&", "^", ">"].includes(temp[0])) {
      // # represents a section, "&" represents an unescaped variable.
      // These should both be considered variables.
      return { type: "variable", name: temp[1] };
    } else {
      return { type: "literal", text: temp[1] };
    }
  });

export const parseMustache = (template: string) => {
  configureMustache();
  const parsed = mustache.parse(template);
  return mustacheTemplateToNodes(parsed);
};

export const interpolateFString = (template: string, values: InputValues) => {
  return parseFString(template).reduce((res, node) => {
    if (node.type === "variable") {
      if (node.name in values) {
        const stringValue =
          typeof values[node.name] === "string"
            ? values[node.name]
            : JSON.stringify(values[node.name]);
        return res + stringValue;
      }
      throw new Error(`(f-string) Missing value for input ${node.name}`);
    }

    return res + node.text;
  }, "");
};

export const interpolateMustache = (template: string, values: InputValues) => {
  configureMustache();
  return mustache.render(template, values);
};

/**
 * Type that represents a function that takes a template string and a set
 * of input values, and returns a string where all variables in the
 * template have been replaced with their corresponding values.
 */
type Interpolator = (template: string, values: InputValues) => string;

/**
 * Type that represents a function that takes a template string and
 * returns an array of `ParsedTemplateNode`.
 */
type Parser = (template: string) => ParsedTemplateNode[];

export const DEFAULT_FORMATTER_MAPPING: Record<TemplateFormat, Interpolator> = {
  "f-string": interpolateFString,
  mustache: interpolateMustache,
};

export const DEFAULT_PARSER_MAPPING: Record<TemplateFormat, Parser> = {
  "f-string": parseFString,
  mustache: parseMustache,
};

export const renderTemplate = (
  template: string,
  templateFormat: TemplateFormat,
  inputValues: InputValues
) => DEFAULT_FORMATTER_MAPPING[templateFormat](template, inputValues);

export const parseTemplate = (
  template: string,
  templateFormat: TemplateFormat
) => DEFAULT_PARSER_MAPPING[templateFormat](template);

export const checkValidTemplate = (
  template: MessageContent,
  templateFormat: TemplateFormat,
  inputVariables: string[]
) => {
  if (!(templateFormat in DEFAULT_FORMATTER_MAPPING)) {
    const validFormats = Object.keys(DEFAULT_FORMATTER_MAPPING);
    throw new Error(`Invalid template format. Got \`${templateFormat}\`;
                         should be one of ${validFormats}`);
  }
  try {
    const dummyInputs: InputValues = inputVariables.reduce((acc, v) => {
      acc[v] = "foo";
      return acc;
    }, {} as Record<string, string>);
    if (Array.isArray(template)) {
      template.forEach((message) => {
        if (message.type === "text") {
          renderTemplate(message.text, templateFormat, dummyInputs);
        } else if (message.type === "image_url") {
          if (typeof message.image_url === "string") {
            renderTemplate(message.image_url, templateFormat, dummyInputs);
          } else {
            const imageUrl = message.image_url.url;
            renderTemplate(imageUrl, templateFormat, dummyInputs);
          }
        } else {
          throw new Error(
            `Invalid message template received. ${JSON.stringify(
              message,
              null,
              2
            )}`
          );
        }
      });
    } else {
      renderTemplate(template, templateFormat, dummyInputs);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    throw new Error(`Invalid prompt schema: ${e.message}`);
  }
};
