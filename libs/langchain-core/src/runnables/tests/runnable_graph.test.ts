/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "vitest";
import { StringOutputParser } from "../../output_parsers/string.js";
import { FakeLLM } from "../../utils/testing/index.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { CommaSeparatedListOutputParser } from "../../output_parsers/list.js";

test("Test graph single runnable", async () => {
  const jsonOutputParser = new StringOutputParser();
  const graph = jsonOutputParser.getGraph();
  const firstNode = graph.firstNode();
  expect(firstNode).not.toBeNull();
  const lastNode = graph.lastNode();
  expect(lastNode).not.toBeNull();
  expect(graph.edges.length).toBe(2);
  expect(Object.keys(graph.nodes).length).toBe(3);
});

test("Test graph sequence", async () => {
  const llm = new FakeLLM({});
  const prompt = PromptTemplate.fromTemplate("Hello, {name}!");
  const listParser = new CommaSeparatedListOutputParser();

  const sequence = prompt.pipe(llm).pipe(listParser);
  const graph = sequence.getGraph();

  const firstNode = graph.firstNode();
  expect(firstNode).not.toBeNull();
  const lastNode = graph.lastNode();
  expect(lastNode).not.toBeNull();

  expect(graph.edges.length).toBe(4);
  expect(Object.keys(graph.nodes).length).toBe(5);

  expect(graph.toJSON()).toStrictEqual({
    nodes: [
      {
        id: 0,
        type: "schema",
        data: {
          title: "PromptTemplateInput",
          $schema: "http://json-schema.org/draft-07/schema#",
        },
      },
      {
        id: 1,
        type: "runnable",
        data: {
          id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
          name: "PromptTemplate",
        },
      },
      {
        id: 2,
        type: "runnable",
        data: {
          id: ["langchain", "llms", "fake", "FakeLLM"],
          name: "FakeLLM",
        },
      },
      {
        id: 3,
        type: "runnable",
        data: {
          id: [
            "langchain_core",
            "output_parsers",
            "list",
            "CommaSeparatedListOutputParser",
          ],
          name: "CommaSeparatedListOutputParser",
        },
      },
      {
        id: 4,
        type: "schema",
        data: {
          title: "CommaSeparatedListOutputParserOutput",
          $schema: "http://json-schema.org/draft-07/schema#",
        },
      },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 1, target: 2 },
      { source: 3, target: 4 },
      { source: 2, target: 3 },
    ],
  });
  expect(graph.drawMermaid())
    .toEqual(`%%{init: {'flowchart': {'curve': 'linear'}}}%%
graph TD;
\tPromptTemplateInput([PromptTemplateInput]):::first
\tPromptTemplate(PromptTemplate)
\tFakeLLM(FakeLLM)
\tCommaSeparatedListOutputParser(CommaSeparatedListOutputParser)
\tCommaSeparatedListOutputParserOutput([CommaSeparatedListOutputParserOutput]):::last
\tPromptTemplateInput --> PromptTemplate;
\tPromptTemplate --> FakeLLM;
\tCommaSeparatedListOutputParser --> CommaSeparatedListOutputParserOutput;
\tFakeLLM --> CommaSeparatedListOutputParser;
\tclassDef default fill:#f2f0ff,line-height:1.2;
\tclassDef first fill-opacity:0;
\tclassDef last fill:#bfb6fc;
`);
});
