import type { TemplateExecutor } from "lodash";
import type { InputValues, PartialValues } from "../utils/types.js";
import { BaseStringPromptTemplate } from "./string.js";
import template from "lodash.template";
import { BasePromptTemplate, TypedPromptInputValues } from "./base.js";
import { StringPromptValueInterface } from "../prompt_values.js";

export class DynamicPromptTemplate<
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	RunInput extends InputValues = any
> extends BaseStringPromptTemplate<RunInput> {
	static lc_name() {
		return 'DynamicPromptTemplate';
	}

	_getPromptType(): 'prompt' {
		return 'prompt';
	}

	templateFn: TemplateExecutor;

	constructor(templateString: string) {
		super({ inputVariables: [] });

		this.templateFn = template(templateString, { interpolate: /\{([\s\S]+?)\}/g });
	}

	static fromTemplate<
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		RunInput extends InputValues = any
	>(templateString: string) {
		return new DynamicPromptTemplate<RunInput>(templateString);
	}

	partial(values: PartialValues): Promise<BasePromptTemplate<
		RunInput,
		StringPromptValueInterface,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		any
	>> {
		throw new Error('Method not implemented.');
	}

	format(values: TypedPromptInputValues<RunInput>): Promise<string> {
		return Promise.resolve(this.templateFn(values));
	}
}