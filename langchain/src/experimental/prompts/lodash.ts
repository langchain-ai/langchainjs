import type { InputValues } from "@langchain/core/utils/types";
import template from "lodash.template";
import { CustomFormatPromptTemplate, CustomFormatPromptTemplateInput } from "./custom_format.js";

export type LodashPromptTemplateInput<RunInput extends InputValues> =
	CustomFormatPromptTemplateInput<RunInput>;

export class LodashPromptTemplate<
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	RunInput extends InputValues = any
> extends CustomFormatPromptTemplate<RunInput> {
	static lc_name() {
		return 'LodashPromptTemplate';
	}

	static fromTemplate<
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		RunInput extends InputValues = any
	>(templateString: string, params?: Omit<
		LodashPromptTemplateInput<RunInput>,
		| "template"
		| "inputVariables"
		| "customParser"
		| "templateValidator"
		| "renderer"
	>) {
		const templateFn = template(templateString, { interpolate: /\{([\s\S]+?)\}/g });

		return super.fromTemplate<RunInput>(templateString, {
			...params,
			validateTemplate: false,
			customParser: (_) => [],
			renderer: (_, values) => templateFn(values),
		});
	}
}