import {
  describe,
  test,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockedFunction,
} from "vitest";
import { drawMermaid, drawMermaidImage } from "../graph_mermaid.js";
import { toBase64Url } from "../utils.js";
import { Edge, Node, RunnableInterface } from "../types.js";

// Mock global fetch
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe("drawMermaidImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("should render a basic Mermaid graph as PNG", async () => {
    const mockBlob = new Blob(["mock image data"], { type: "image/png" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const mermaidSyntax = "graph TD; A --> B;";
    const result = await drawMermaidImage(mermaidSyntax);

    expect(result).toBe(mockBlob);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Check the URL construction
    const expectedEncodedSyntax = toBase64Url(mermaidSyntax);
    const expectedUrl = `https://mermaid.ink/img/${expectedEncodedSyntax}?bgColor=!white&type=png`;
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test("should handle different image types", async () => {
    const mockBlob = new Blob(["mock image data"], { type: "image/jpeg" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const mermaidSyntax = "graph LR; Start --> End;";
    const result = await drawMermaidImage(mermaidSyntax, {
      imageType: "jpeg",
    });

    expect(result).toBe(mockBlob);
    const expectedEncodedSyntax = toBase64Url(mermaidSyntax);
    const expectedUrl = `https://mermaid.ink/img/${expectedEncodedSyntax}?bgColor=!white&type=jpeg`;
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test("should handle webp image type", async () => {
    const mockBlob = new Blob(["mock image data"], { type: "image/webp" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const mermaidSyntax = "graph TB; X --> Y;";
    const result = await drawMermaidImage(mermaidSyntax, {
      imageType: "webp",
    });

    expect(result).toBe(mockBlob);
    const expectedEncodedSyntax = toBase64Url(mermaidSyntax);
    const expectedUrl = `https://mermaid.ink/img/${expectedEncodedSyntax}?bgColor=!white&type=webp`;
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test("should handle hex color backgrounds", async () => {
    const mockBlob = new Blob(["mock image data"], { type: "image/png" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const mermaidSyntax = "flowchart TD; A --> B;";
    const result = await drawMermaidImage(mermaidSyntax, {
      backgroundColor: "#FF5733",
    });

    expect(result).toBe(mockBlob);
    const expectedEncodedSyntax = toBase64Url(mermaidSyntax);
    const expectedUrl = `https://mermaid.ink/img/${expectedEncodedSyntax}?bgColor=#FF5733&type=png`;
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test("should handle short hex color backgrounds", async () => {
    const mockBlob = new Blob(["mock image data"], { type: "image/png" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const mermaidSyntax = "flowchart TD; A --> B;";
    const result = await drawMermaidImage(mermaidSyntax, {
      backgroundColor: "#FFF",
    });

    expect(result).toBe(mockBlob);
    const expectedEncodedSyntax = toBase64Url(mermaidSyntax);
    const expectedUrl = `https://mermaid.ink/img/${expectedEncodedSyntax}?bgColor=#FFF&type=png`;
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test("should handle named color backgrounds", async () => {
    const mockBlob = new Blob(["mock image data"], { type: "image/png" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const mermaidSyntax = "classDiagram; class A; class B;";
    const result = await drawMermaidImage(mermaidSyntax, {
      backgroundColor: "transparent",
    });

    expect(result).toBe(mockBlob);
    const expectedEncodedSyntax = toBase64Url(mermaidSyntax);
    const expectedUrl = `https://mermaid.ink/img/${expectedEncodedSyntax}?bgColor=!transparent&type=png`;
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test("should throw error when API returns non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
    } as Response);

    const mermaidSyntax = "invalid syntax";

    await expect(drawMermaidImage(mermaidSyntax)).rejects.toThrow(
      "Failed to render the graph using the Mermaid.INK API.\nStatus code: 400\nStatus text: Bad Request"
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("should handle network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const mermaidSyntax = "graph TD; A --> B;";

    await expect(drawMermaidImage(mermaidSyntax)).rejects.toThrow(
      "Network error"
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("should properly encode complex Mermaid syntax", async () => {
    const mockBlob = new Blob(["mock image data"], { type: "image/png" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const complexSyntax = `graph TD;
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]`;

    const result = await drawMermaidImage(complexSyntax);

    expect(result).toBe(mockBlob);
    const expectedEncodedSyntax = toBase64Url(complexSyntax);
    const expectedUrl = `https://mermaid.ink/img/${expectedEncodedSyntax}?bgColor=!white&type=png`;
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test("should handle undefined background color", async () => {
    const mockBlob = new Blob(["mock image data"], { type: "image/png" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const mermaidSyntax = "graph TD; A --> B;";
    const result = await drawMermaidImage(mermaidSyntax, {
      backgroundColor: undefined,
    });

    expect(result).toBe(mockBlob);
    const expectedEncodedSyntax = toBase64Url(mermaidSyntax);
    const expectedUrl = `https://mermaid.ink/img/${expectedEncodedSyntax}?bgColor=!white&type=png`;
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test("should handle server error with different status codes", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    const mermaidSyntax = "graph TD; A --> B;";

    await expect(drawMermaidImage(mermaidSyntax)).rejects.toThrow(
      "Failed to render the graph using the Mermaid.INK API.\nStatus code: 500\nStatus text: Internal Server Error"
    );
  });

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
