import { test, expect } from "vitest";
import { stringify } from "yaml";
import { RunnableSequence } from "@langchain/core/runnables";
import { OpenAI, ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { Serializable } from "@langchain/core/load/serializable";

import { load } from "../index.js";

test("serialize + deserialize custom classes", async () => {
  class Person extends Serializable {
    lc_namespace = ["langchain", "tests"];

    get lc_secrets(): { [key: string]: string } | undefined {
      return { apiKey: "PERSON_API_KEY" };
    }

    get lc_attributes(): { [key: string]: unknown } | undefined {
      return { hello: this.hello };
    }

    lc_serializable = true;

    hello = 3;

    constructor(fields: { aField: string; apiKey: string; hello?: number }) {
      super(fields);
    }
  }

  class SpecialPerson extends Person {
    get lc_secrets(): { [key: string]: string } | undefined {
      return {
        anotherApiKey: "SPECIAL_PERSON_API_KEY",
        inherited: "SPECIAL_PERSON_INHERITED_API_KEY",
        "nested.api.key": "SPECIAL_PERSON_NESTED_API_KEY",
      };
    }

    get lc_attributes(): { [key: string]: unknown } | undefined {
      return { by: this.bye };
    }

    bye = 4;

    inherited: string;

    nested: { api: { key: string } };

    constructor(fields: {
      aField: string;
      apiKey: string;
      anotherApiKey: string;
      inehrited?: string;
      nested?: { api: { key: string } };
      hello?: number;
      bye?: number;
    }) {
      super(fields);

      this.inherited = fields.inehrited ?? "i-key";
      this.nested = fields.nested ?? { api: { key: "n-key" } };
    }
  }

  const person = new Person({ aField: "hello", apiKey: "a-key" });
  const lc_argumentsBefore = person.lc_kwargs;
  const str = JSON.stringify(person, null, 2);
  expect(person.lc_kwargs).toEqual(lc_argumentsBefore);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const person2 = await load<Person>(
    str,
    {
      PERSON_API_KEY: "a-key",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      "langchain/tests": { Person },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  );
  expect(person2).toBeInstanceOf(Person);
  expect(JSON.stringify(person2, null, 2)).toBe(str);

  const sperson = new SpecialPerson({
    aField: "hello",
    apiKey: "a-key",
    anotherApiKey: "b-key",

    // We explicitly do not provide the inherited and nested key
    // to test that it has been extracted during serialisation
    // simulating obtaining value from environment value

    // inherited: "i-key",
    // nested: { api: { key: "n-key" } },
  });
  const sstr = JSON.stringify(sperson, null, 2);
  expect(stringify(JSON.parse(sstr))).toMatchSnapshot();
  const sperson2 = await load<Person>(
    sstr,
    {
      PERSON_API_KEY: "a-key",
      SPECIAL_PERSON_API_KEY: "b-key",
      SPECIAL_PERSON_NESTED_API_KEY: "n-key",
      SPECIAL_PERSON_INHERITED_API_KEY: "i-key",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      "langchain/tests": { SpecialPerson },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  );
  expect(sperson2).toBeInstanceOf(SpecialPerson);
  expect(JSON.stringify(sperson2, null, 2)).toBe(sstr);
});

test("serialize + deserialize llm", async () => {
  process.env.OPENAI_API_KEY = "openai-key";
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
  });
  llm.temperature = 0.7;
  const lc_argumentsBefore = llm.lc_kwargs;
  const str = JSON.stringify(llm, null, 2);
  expect(llm.lc_kwargs).toEqual(lc_argumentsBefore);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  expect(JSON.parse(str).kwargs.temperature).toBe(0.7);
  expect(JSON.parse(str).kwargs.model).toBe("davinci");
  expect(JSON.parse(str).kwargs.openai_api_key.type).toBe("secret");
  // Accept secret in secret map
  const llm2 = await load<OpenAI>(
    str,
    {
      OPENAI_API_KEY: "openai-key",
    },
    {},
    {
      llms__openai: { OpenAI },
    }
  );
  expect(llm2).toBeInstanceOf(OpenAI);
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
  // Accept secret as env var
  const llm3 = await load<OpenAI>(
    str,
    {},
    {},
    {
      llms__openai: { OpenAI },
    }
  );
  expect(llm3).toBeInstanceOf(OpenAI);
  expect(llm.openAIApiKey).toBe(llm3.openAIApiKey);
  expect(JSON.stringify(llm3, null, 2)).toBe(str);
});

test("serialize + deserialize with new and old ids", async () => {
  const prompt = PromptTemplate.fromTemplate("Hello, {name}!");
  const strWithNewId = JSON.stringify(prompt, null, 2);
  expect(stringify(JSON.parse(strWithNewId))).toMatchSnapshot();
  expect(JSON.parse(strWithNewId).id).toEqual([
    "langchain_core",
    "prompts",
    "prompt",
    "PromptTemplate",
  ]);
  const strWithOldId = JSON.stringify({
    ...JSON.parse(strWithNewId),
    id: ["langchain", "prompts", "prompt", "PromptTemplate"],
  });
  const prompt2 = await load<PromptTemplate>(strWithOldId);
  expect(prompt2).toBeInstanceOf(PromptTemplate);
  const prompt3 = await load<PromptTemplate>(strWithNewId);
  expect(prompt3).toBeInstanceOf(PromptTemplate);
});

test("serialize + deserialize runnable sequence with new and old ids", async () => {
  const runnable = RunnableSequence.from([
    ChatPromptTemplate.fromTemplate("hi there"),
    new ChatOpenAI({ model: "gpt-4o-mini" }),
  ]);
  const strWithNewId = JSON.stringify(runnable, null, 2);
  expect(stringify(JSON.parse(strWithNewId))).toMatchSnapshot();
  expect(JSON.parse(strWithNewId).id).toEqual([
    "langchain_core",
    "runnables",
    "RunnableSequence",
  ]);
  const strWithOldId = JSON.stringify({
    ...JSON.parse(strWithNewId),
    id: ["langchain", "schema", "runnable", "RunnableSequence"],
  });
  const runnable2 = await load<RunnableSequence>(
    strWithOldId,
    {},
    {},
    {
      chat_models__openai: { ChatOpenAI },
    }
  );
  expect(runnable2).toBeInstanceOf(RunnableSequence);
  const runnable3 = await load<RunnableSequence>(
    strWithNewId,
    {},
    {},
    {
      chat_models__openai: { ChatOpenAI },
    }
  );
  expect(runnable3).toBeInstanceOf(RunnableSequence);
});

test("override name of objects when serialising", async () => {
  const llm = new OpenAI({ temperature: 0.5, apiKey: "openai-key" });
  const str = JSON.stringify(llm, null, 2);

  class MangledName extends OpenAI {}
  const llm2 = await load<OpenAI>(
    str,
    { OPENAI_API_KEY: "openai-key" },
    { "langchain/llms/openai": { OpenAI: MangledName } }
  );
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
});

test("Should load traces even if the constructor name changes (minified environments)", async () => {
  const llm = new OpenAI({ temperature: 0.5, apiKey: "openai-key" });
  Object.defineProperty(llm.constructor, "name", {
    value: "x",
  });
  const str = JSON.stringify(llm, null, 2);
  // console.log(str);

  const llm2 = await load<OpenAI>(
    str,
    { COHERE_API_KEY: "cohere-key" },
    { "langchain/llms/openai": { OpenAI } }
  );
  // console.log(JSON.stringify(llm2, null, 2));
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
});

test("Should load a real-world serialized chain", async () => {
  const serializedValue = `{"lc": 1, "type": "constructor", "id": ["langchain_core", "runnables", "RunnableSequence"], "kwargs": {"first": {"lc": 1, "type": "constructor", "id": ["langchain_core", "runnables", "RunnableParallel"], "kwargs": {"steps": {"equation_statement": {"lc": 1, "type": "constructor", "id": ["langchain_core", "runnables", "RunnablePassthrough"], "kwargs": {"func": null, "afunc": null, "input_type": null}}}}}, "middle": [{"lc": 1, "type": "constructor", "id": ["langchain_core", "prompts", "chat", "ChatPromptTemplate"], "kwargs": {"input_variables": ["equation_statement"], "messages": [{"lc": 1, "type": "constructor", "id": ["langchain_core", "prompts", "chat", "SystemMessagePromptTemplate"], "kwargs": {"prompt": {"lc": 1, "type": "constructor", "id": ["langchain_core", "prompts", "prompt", "PromptTemplate"], "kwargs": {"input_variables": [], "template": "Write out the following equation using algebraic symbols then solve it. Use the format\\n\\nEQUATION:...\\nSOLUTION:...\\n\\n", "template_format": "f-string", "partial_variables": {}}}}}, {"lc": 1, "type": "constructor", "id": ["langchain_core", "prompts", "chat", "HumanMessagePromptTemplate"], "kwargs": {"prompt": {"lc": 1, "type": "constructor", "id": ["langchain_core", "prompts", "prompt", "PromptTemplate"], "kwargs": {"input_variables": ["equation_statement"], "template": "{equation_statement}", "template_format": "f-string", "partial_variables": {}}}}}]}}, {"lc": 1, "type": "constructor", "id": ["langchain", "chat_models", "openai", "ChatOpenAI"], "kwargs": {"temperature": 0.0, "openai_api_key": {"lc": 1, "type": "secret", "id": ["OPENAI_API_KEY"]}}}], "last": {"lc": 1, "type": "constructor", "id": ["langchain_core", "output_parsers", "string", "StrOutputParser"], "kwargs": {}}}}`;
  const chain = await load<RunnableSequence>(
    serializedValue,
    {
      OPENAI_API_KEY: "openai-key",
    },
    {},
    {
      chat_models__openai: { ChatOpenAI },
    }
  );
  // @ts-expect-error testing
  expect(chain.first.constructor.lc_name()).toBe("RunnableMap");
  // @ts-expect-error testing
  expect(chain.middle.length).toBe(2);
  // @ts-expect-error testing
  expect(chain.middle[0].constructor.lc_name()).toBe(`ChatPromptTemplate`);
  // @ts-expect-error testing
  expect(chain.middle[1].constructor.lc_name()).toBe(`ChatOpenAI`);
  // @ts-expect-error testing
  expect(chain.last.constructor.lc_name()).toBe(`StrOutputParser`);
});
