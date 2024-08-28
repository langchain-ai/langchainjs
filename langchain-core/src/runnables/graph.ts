import { zodToJsonSchema } from "zod-to-json-schema";
import { v4 as uuidv4, validate as isUuid } from "uuid";
import type {
  RunnableInterface,
  RunnableIOSchema,
  Node,
  Edge,
} from "./types.js";
import { isRunnableInterface } from "./utils.js";
import { drawMermaid, drawMermaidPng } from "./graph_mermaid.js";

const MAX_DATA_DISPLAY_NAME_LENGTH = 42;

export { Node, Edge };

function nodeDataStr(node: Node): string {
  if (!isUuid(node.id)) {
    return node.id;
  } else if (isRunnableInterface(node.data)) {
    try {
      let data = node.data.getName();
      data = data.startsWith("Runnable") ? data.slice("Runnable".length) : data;
      if (data.length > MAX_DATA_DISPLAY_NAME_LENGTH) {
        data = `${data.substring(0, MAX_DATA_DISPLAY_NAME_LENGTH)}...`;
      }
      return data;
    } catch (error) {
      return node.data.getName();
    }
  } else {
    return node.data.name ?? "UnknownSchema";
  }
}

function nodeDataJson(node: Node) {
  // if node.data is implements Runnable
  if (isRunnableInterface(node.data)) {
    return {
      type: "runnable",
      data: {
        id: node.data.lc_id,
        name: node.data.getName(),
      },
    };
  } else {
    return {
      type: "schema",
      data: { ...zodToJsonSchema(node.data.schema), title: node.data.name },
    };
  }
}

export class Graph {
  nodes: Record<string, Node> = {};

  edges: Edge[] = [];

  // Convert the graph to a JSON-serializable format.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    const stableNodeIds: Record<string, string | number> = {};
    Object.values(this.nodes).forEach((node, i) => {
      stableNodeIds[node.id] = isUuid(node.id) ? i : node.id;
    });

    return {
      nodes: Object.values(this.nodes).map((node) => ({
        id: stableNodeIds[node.id],
        ...nodeDataJson(node),
      })),
      edges: this.edges.map((edge) => {
        const item: Record<string, unknown> = {
          source: stableNodeIds[edge.source],
          target: stableNodeIds[edge.target],
        };

        if (typeof edge.data !== "undefined") {
          item.data = edge.data;
        }

        if (typeof edge.conditional !== "undefined") {
          item.conditional = edge.conditional;
        }
        return item;
      }),
    };
  }

  addNode(data: RunnableInterface | RunnableIOSchema, id?: string): Node {
    if (id !== undefined && this.nodes[id] !== undefined) {
      throw new Error(`Node with id ${id} already exists`);
    }
    const nodeId = id || uuidv4();
    const node: Node = { id: nodeId, data };
    this.nodes[nodeId] = node;
    return node;
  }

  removeNode(node: Node): void {
    // Remove the node from the nodes map
    delete this.nodes[node.id];

    // Filter out edges connected to the node
    this.edges = this.edges.filter(
      (edge) => edge.source !== node.id && edge.target !== node.id
    );
  }

  addEdge(
    source: Node,
    target: Node,
    data?: string,
    conditional?: boolean
  ): Edge {
    if (this.nodes[source.id] === undefined) {
      throw new Error(`Source node ${source.id} not in graph`);
    }
    if (this.nodes[target.id] === undefined) {
      throw new Error(`Target node ${target.id} not in graph`);
    }
    const edge: Edge = {
      source: source.id,
      target: target.id,
      data,
      conditional,
    };
    this.edges.push(edge);
    return edge;
  }

  firstNode(): Node | undefined {
    const targets = new Set(this.edges.map((edge) => edge.target));
    const found: Node[] = [];
    Object.values(this.nodes).forEach((node) => {
      if (!targets.has(node.id)) {
        found.push(node);
      }
    });
    return found[0];
  }

  lastNode(): Node | undefined {
    const sources = new Set(this.edges.map((edge) => edge.source));
    const found: Node[] = [];
    Object.values(this.nodes).forEach((node) => {
      if (!sources.has(node.id)) {
        found.push(node);
      }
    });
    return found[0];
  }

  /**
   * Add all nodes and edges from another graph.
   * Note this doesn't check for duplicates, nor does it connect the graphs.
   */
  extend(graph: Graph, prefix: string = "") {
    let finalPrefix = prefix;
    const nodeIds = Object.values(graph.nodes).map((node) => node.id);
    if (nodeIds.every(isUuid)) {
      finalPrefix = "";
    }

    const prefixed = (id: string) => {
      return finalPrefix ? `${finalPrefix}:${id}` : id;
    };

    Object.entries(graph.nodes).forEach(([key, value]) => {
      this.nodes[prefixed(key)] = { ...value, id: prefixed(key) };
    });

    const newEdges = graph.edges.map((edge) => {
      return {
        ...edge,
        source: prefixed(edge.source),
        target: prefixed(edge.target),
      };
    });
    // Add all edges from the other graph
    this.edges = [...this.edges, ...newEdges];
    const first = graph.firstNode();
    const last = graph.lastNode();
    return [
      first ? { id: prefixed(first.id), data: first.data } : undefined,
      last ? { id: prefixed(last.id), data: last.data } : undefined,
    ];
  }

  trimFirstNode(): void {
    const firstNode = this.firstNode();
    if (firstNode) {
      const outgoingEdges = this.edges.filter(
        (edge) => edge.source === firstNode.id
      );
      if (Object.keys(this.nodes).length === 1 || outgoingEdges.length === 1) {
        this.removeNode(firstNode);
      }
    }
  }

  trimLastNode(): void {
    const lastNode = this.lastNode();
    if (lastNode) {
      const incomingEdges = this.edges.filter(
        (edge) => edge.target === lastNode.id
      );
      if (Object.keys(this.nodes).length === 1 || incomingEdges.length === 1) {
        this.removeNode(lastNode);
      }
    }
  }

  drawMermaid(params?: {
    withStyles?: boolean;
    curveStyle?: string;
    nodeColors?: Record<string, string>;
    wrapLabelNWords?: number;
  }): string {
    const {
      withStyles,
      curveStyle,
      nodeColors = { start: "#ffdfba", end: "#baffc9", other: "#fad7de" },
      wrapLabelNWords,
    } = params ?? {};
    const nodes: Record<string, string> = {};
    for (const node of Object.values(this.nodes)) {
      nodes[node.id] = nodeDataStr(node);
    }

    const firstNode = this.firstNode();
    const firstNodeLabel = firstNode ? nodeDataStr(firstNode) : undefined;

    const lastNode = this.lastNode();
    const lastNodeLabel = lastNode ? nodeDataStr(lastNode) : undefined;

    return drawMermaid(nodes, this.edges, {
      firstNodeLabel,
      lastNodeLabel,
      withStyles,
      curveStyle,
      nodeColors,
      wrapLabelNWords,
    });
  }

  async drawMermaidPng(params?: {
    withStyles?: boolean;
    curveStyle?: string;
    nodeColors?: Record<string, string>;
    wrapLabelNWords?: number;
    backgroundColor?: string;
  }): Promise<Blob> {
    const mermaidSyntax = this.drawMermaid(params);
    return drawMermaidPng(mermaidSyntax, {
      backgroundColor: params?.backgroundColor,
    });
  }
}
