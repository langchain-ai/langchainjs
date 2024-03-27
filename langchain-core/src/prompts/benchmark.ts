import { Bench } from 'tinybench';
import { PromptTemplate } from './prompt.js';
import { DynamicPromptTemplate } from './dynamic.js';

// (async () => {

//   const promptTemplate = `
//   Simple: {simple}
//   Nested:
//   - {nested.a}
//   - {nested.b}`;

//   const nativePromptFormatted = await nativePrompt.format({
//     simple: 'simple',
//     nested: { a: '1', b: '2' },
//     'nested.a': 'A',
//     'nested.b': 'B',
//   });
//   console.log(nativePromptFormatted);

//   const dynamicPromptFormatted = await dynamicPrompt.format({
//     simple: 'simple',
//     nested: { a: '1', b: '2' },
//     'nested.a': 'A',
//     'nested.b': 'B',
//   });
//   console.log(dynamicPromptFormatted);
// })();



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
	const bench = new Bench({ time: 1000 });
	// simple prompts
	bench
		.add('DynamicPromptTemplate: simple', async () => {
			await simpleDynamicPrompt.format(simpleInput);
		})
		.add('PromptTemplate: simple', async () => {
			await simpleNativePrompt.format(simpleInput);
		});

	await bench.warmup();
	await bench.run();

	console.log("Simple prompts:")
	console.table(bench.table());
})();

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
	const bench = new Bench({ time: 1000 });
	// complex prompts
	bench
		.add('DynamicPromptTemplate: complex', async () => {
			await complexDynamicPrompt.format(complexInput);
		})
		.add('PromptTemplate: complex', async () => {
			await complexNativePrompt.format(complexInput);
		});

	await bench.warmup();
	await bench.run();

	console.log("Complex prompts:")
	console.table(bench.table());
})();