import { Runnable } from "../runnables/base.js";
import type { InputValues } from "../utils/types/index.js";
import { TypedPromptInputValues } from "./base.js";
import { parseTemplate, renderTemplate, TemplateFormat } from "./template.js";

export class DictPromptTemplate<
  RunInput extends InputValues = InputValues,
  RunOutput extends Record<string, unknown> = Record<string, unknown>
> extends Runnable<TypedPromptInputValues<RunInput>, RunOutput> {
  lc_namespace = ["langchain_core", "prompts", "dict"];

  lc_serializable = true;

  template: Record<string, unknown>;

  templateFormat: TemplateFormat;

  inputVariables: Array<Extract<keyof RunInput, string>>;

  static lc_name() {
    return "DictPromptTemplate";
  }

  constructor(fields: {
    template: Record<string, unknown>;
    templateFormat?: TemplateFormat;
  }) {
    const templateFormat = fields.templateFormat ?? "f-string";
    const inputVariables = _getInputVariables(
      fields.template,
      templateFormat
    ) as Array<Extract<keyof RunInput, string>>;
    super({ inputVariables, ...fields });
    this.template = fields.template;
    this.templateFormat = templateFormat;
    this.inputVariables = inputVariables;
  }

  async format(values: TypedPromptInputValues<RunInput>): Promise<RunOutput> {
    return _insertInputVariables(
      this.template,
      values,
      this.templateFormat
    ) as RunOutput;
  }

  async invoke(
    values: TypedPromptInputValues<InputValues>
  ): Promise<RunOutput> {
    return await this._callWithConfig(this.format.bind(this), values, {
      runType: "prompt",
    });
  }
}

function _getInputVariables(
  template: Record<string, unknown>,
  templateFormat: TemplateFormat
): Array<Extract<keyof InputValues, string>> {
  const inputVariables: Array<Extract<keyof InputValues, string>> = [];
  for (const v of Object.values(template)) {
    if (typeof v === "string") {
      parseTemplate(v, templateFormat).forEach((t) => {
        if (t.type === "variable") {
          inputVariables.push(t.name);
        }
      });
    } else if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === "string") {
          parseTemplate(x, templateFormat).forEach((t) => {
            if (t.type === "variable") {
              inputVariables.push(t.name);
            }
          });
        } else if (typeof x === "object") {
          inputVariables.push(..._getInputVariables(x, templateFormat));
        }
      }
    } else if (typeof v === "object" && v !== null) {
      inputVariables.push(
        ..._getInputVariables(v as Record<string, unknown>, templateFormat)
      );
    }
  }
  return Array.from(new Set(inputVariables));
}

function _insertInputVariables(
  template: Record<string, unknown>,
  inputs: TypedPromptInputValues<InputValues>,
  templateFormat: TemplateFormat
): Record<string, unknown> {
  const formatted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(template)) {
    if (typeof v === "string") {
      formatted[k] = renderTemplate(v, templateFormat, inputs);
    } else if (Array.isArray(v)) {
      const formattedV: Array<unknown> = [];
      for (const x of v) {
        if (typeof x === "string") {
          formattedV.push(renderTemplate(x, templateFormat, inputs));
        } else if (typeof x === "object") {
          formattedV.push(_insertInputVariables(x, inputs, templateFormat));
        }
      }
      formatted[k] = formattedV;
    } else if (typeof v === "object" && v !== null) {
      formatted[k] = _insertInputVariables(
        v as Record<string, unknown>,
        inputs,
        templateFormat
      );
    } else {
      formatted[k] = v;
    }
  }
  return formatted;
}
