/* eslint-disable @typescript-eslint/no-floating-promises */
import { Bench } from "tinybench";
import { HandlebarsPromptTemplate } from "langchain/experimental/prompts/handlebars";
import { LodashPromptTemplate } from "langchain/experimental/prompts/lodash";
import { PromptTemplate } from "@langchain/core/prompts";

// type NestedInput = {
// 	foo: {
// 		bar: {
// 			baz: string;
// 		};
// 	};
// };

// const nestedDynamicPrompt = LodashPromptTemplate.fromTemplate<NestedInput>(`{foo.bar.baz}`);

// const formatted = nestedDynamicPrompt.format({
// 	foo: {
// 		bar: {
// 			baz: 'baz',
// 		},
// 	},
// });

type SimpleInput = { foo: string; bar: string };
const simpleInput: SimpleInput = { foo: "foo", bar: "bar" };
const simpleNativePrompt =
  PromptTemplate.fromTemplate<SimpleInput>(`{foo}{bar}`);
const simpleLodashPrompt =
  LodashPromptTemplate.fromTemplate<SimpleInput>(`{foo}{bar}`);
const simpleHandlebarsPrompt =
  HandlebarsPromptTemplate.fromTemplate<SimpleInput>(`{{foo}}{{bar}}`);

type ComplexInput = Record<string, string>;
const complexInput: Record<string, string> = Object.fromEntries(
  [...Array(100).keys()].map((i) => [`key${i}`, `value${i}`])
);

const complexNativePrompt = PromptTemplate.fromTemplate<ComplexInput>(
  Object.keys(complexInput)
    .map((key) => `${key}: {${key}}`)
    .join(`\n`)
);
const complexLodashPrompt = LodashPromptTemplate.fromTemplate<ComplexInput>(
  Object.keys(complexInput)
    .map((key) => `${key}: {${key}}`)
    .join(`\n`)
);
const complexHandlebarsPrompt =
  HandlebarsPromptTemplate.fromTemplate<ComplexInput>(
    Object.keys(complexInput)
      .map((key) => `${key}: {{${key}}}`)
      .join(`\n`)
  );

console.log("Simple input:");
console.log(simpleInput);
console.log("Complex input:");
console.log(complexInput);

const formattedNative = await complexNativePrompt.format(complexInput);
const formattedLodash = await complexLodashPrompt.format(complexInput);
const formattedHandlebars = await complexHandlebarsPrompt.format(complexInput);

if (
  formattedNative !== formattedLodash ||
  formattedNative !== formattedHandlebars
) {
  throw new Error("Formatted outputs do not match");
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
const simple = new Bench({ time: 1000 });
// simple prompts
simple
  .add("PromptTemplate: simple", async () => {
    await simpleNativePrompt.format(simpleInput);
  })
  .add("LodashPromptTemplate: simple", async () => {
    await simpleLodashPrompt.format(simpleInput);
  })
  .add("HandlebarsPromptTemplate: simple", async () => {
    await simpleHandlebarsPrompt.format(simpleInput);
  });

await simple.warmup();
await simple.run();

console.log("Simple prompts:");
console.table(simple.table());

const complex = new Bench({ time: 1000 });
// complex prompts
complex
  .add("PromptTemplate: complex", async () => {
    await complexNativePrompt.format(complexInput);
  })
  .add("LodashPromptTemplate: complex", async () => {
    await complexLodashPrompt.format(complexInput);
  })
  .add("HandlebarsPromptTemplate: complex", async () => {
    await complexHandlebarsPrompt.format(complexInput);
  });

await complex.warmup();
await complex.run();

console.log("Complex prompts:");
console.table(complex.table());
