/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "@jest/globals";
import { drawMermaid } from "../../runnables/graph_mermaid.js";
import { Edge, Node, RunnableInterface } from "../../runnables/types.js";

describe("drawMermaid", () => {
  test("nests deep subgraphs correctly", () => {
    const data = {} as RunnableInterface;

    const nodes: Record<string, Node> = {
      __start__: {
        id: "__start__",
        data,
        name: "__start__",
      },
      collectTools: {
        id: "collectTools",
        data,
        name: "collectTools",
        metadata: {},
      },
      "fooTool:userVerification": {
        id: "fooTool:userVerification",
        data,
        name: "userVerification",
        metadata: {},
      },
      "fooTool:fooSearchSource:explainReasoning": {
        id: "fooTool:fooSearchSource:explainReasoning",
        data,
        name: "explainReasoning",
        metadata: {},
      },
      "fooTool:fooSearchSource:fooGenericSearch:promptForTools": {
        id: "fooTool:fooSearchSource:fooGenericSearch:promptForTools",
        data,
        name: "promptForTools",
        metadata: {},
      },
      "fooTool:fooSearchSource:fooGenericSearch:searchToolWithQuery": {
        id: "fooTool:fooSearchSource:fooGenericSearch:searchToolWithQuery",
        data,
        name: "searchToolWithQuery",
        metadata: {},
      },
      "fooTool:fooSearchSource:emitfooToolResults": {
        id: "fooTool:fooSearchSource:emitfooToolResults",
        data,
        name: "emitfooToolResults",
        metadata: {},
      },
      "fooTool:reportToolResults": {
        id: "fooTool:reportToolResults",
        data,
        name: "reportToolResults",
        metadata: {},
      },
      promptForAnswer: {
        id: "promptForAnswer",
        data,
        name: "promptForAnswer",
        metadata: {},
      },
      __end__: {
        id: "__end__",
        data,
        name: "__end__",
      },
    };

    const edges: Edge[] = [
      {
        source: "fooTool:fooSearchSource:fooGenericSearch:promptForTools",
        target: "fooTool:fooSearchSource:fooGenericSearch:searchToolWithQuery",
        conditional: false,
      },
      {
        source: "fooTool:fooSearchSource:fooGenericSearch:searchToolWithQuery",
        target: "fooTool:fooSearchSource:emitfooToolResults",
        conditional: false,
      },
      {
        source: "fooTool:fooSearchSource:explainReasoning",
        target: "fooTool:fooSearchSource:fooGenericSearch:promptForTools",
        conditional: false,
      },
      {
        source: "fooTool:fooSearchSource:emitfooToolResults",
        target: "fooTool:reportToolResults",
        conditional: false,
      },
      {
        source: "fooTool:userVerification",
        target: "fooTool:fooSearchSource:explainReasoning",
        conditional: true,
      },
      {
        source: "__start__",
        target: "collectTools",
        conditional: false,
      },
      {
        source: "fooTool:reportToolResults",
        target: "promptForAnswer",
        conditional: false,
      },
      {
        source: "collectTools",
        target: "fooTool:userVerification",
        conditional: true,
      },
      {
        source: "promptForAnswer",
        target: "__end__",
        conditional: true,
      },
    ];

    const result = drawMermaid(nodes, edges);

    expect(result).toContain("subgraph fooTool");
    expect(result).toContain("subgraph fooSearchSource");
    expect(result).toContain("subgraph fooGenericSearch");

    // verify proper nested order of subgraphs
    const nestedPattern = [
      "subgraph fooTool",
      "subgraph fooSearchSource",
      "subgraph fooGenericSearch",
      // ... inside fooGenericSearch
      "end",
      // ... inside fooSearchSource
      "end",
      // ... inside fooTool
      "end",
    ].join("[\\s\\S]*?");

    expect(result).toMatch(new RegExp(nestedPattern));
  });
});
