/* eslint-disable @typescript-eslint/no-floating-promises */
import { Bench } from 'tinybench';
import { PromptTemplate } from './prompt.js';
import { DynamicPromptTemplate } from './dynamic.js';

type NestedInput = {
	foo: {
		bar: {
			baz: string;
		};
	};
};

const nestedDynamicPrompt = DynamicPromptTemplate.fromTemplate<NestedInput>(`{foo.bar.baz}`);

const formatted = nestedDynamicPrompt.format({
	foo: {
		bar: {
			baz: 'baz',
		},
	},
});

type SimpleInput = { foo: string; bar: string };
const simpleInput: SimpleInput = { foo: 'foo', bar: 'bar' };
const simplePromptTemplate = `{foo}{bar}`;

const simpleNativePrompt = PromptTemplate.fromTemplate<SimpleInput>(simplePromptTemplate);
const simpleDynamicPrompt = DynamicPromptTemplate.fromTemplate<SimpleInput>(simplePromptTemplate);

type ComplexInput = Record<string, string>;
const complexInput: Record<string, string> = Array(100)
	.map((_, i) => ({ [`key${i}`]: `value${i}` }))
	.reduce((acc, curr) => ({ ...acc, ...curr }), {});

const complexPromptTemplate = Object.entries(complexInput)
	.map(([key, value]) => `${key}: {${key}}`)
	.join(`\n`);

const complexNativePrompt = PromptTemplate.fromTemplate<ComplexInput>(complexPromptTemplate);
const complexDynamicPrompt = DynamicPromptTemplate.fromTemplate<ComplexInput>(complexPromptTemplate);

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
	const simple = new Bench({ time: 1000 });
	// simple prompts
	simple
		.add('DynamicPromptTemplate: simple', async () => {
			await simpleDynamicPrompt.format(simpleInput);
		})
		.add('PromptTemplate: simple', async () => {
			await simpleNativePrompt.format(simpleInput);
		});

	await simple.warmup();
	await simple.run();

	console.log("Simple prompts:")
	console.table(simple.table());

	const complex = new Bench({ time: 1000 });
	// complex prompts
	complex
		.add('DynamicPromptTemplate: complex', async () => {
			await complexDynamicPrompt.format(complexInput);
		})
		.add('PromptTemplate: complex', async () => {
			await complexNativePrompt.format(complexInput);
		});

	await complex.warmup();
	await complex.run();

	console.log("Complex prompts:")
	console.table(complex.table());
})();

