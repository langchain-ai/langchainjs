import { v4 as uuidv4, validate as isUuid } from "uuid";
import { z } from "zod";
import { type Runnable as RunnableType, Runnable } from "./base.js";

interface Edge {
  source: string;
  target: string;
  data?: string;
}

interface Node {
  id: string;

  // eslint-disable-next-line @typescript-eslint/ban-types
  data: Function | RunnableType;
}

function nodeDataStr(node: Node): string {
  if (!isUuid(node.id)) {
    return node.id;
  } else if (Runnable.isRunnable(node.data)) {
    try {
      let data = node.data.toString();
      if (
        data.startsWith("<") ||
        data[0] !== data[0].toUpperCase() ||
        data.split("\n").length > 1
      ) {
        data = node.data.constructor.name;
      } else if (data.length > 42) {
        data = `${data.substring(0, 42)}...`;
      }
      return data.startsWith("Runnable") ? data.substring(8) : data;
    } catch (error) {
      return node.data.constructor.name;
    }
  } else {
    return node.data.name; // Assuming `data` can be a class reference
  }
}

function nodeDataJson(node: Node) {
  // if node.data is implements Runnable
  if (Runnable.isRunnable(node.data)) {
    return {
      type: "runnable",
      data: {
        id: node.data.lc_id,
        name: node.data.getName(),
      },
    };
  }

  if (typeof node.data === "object" && node.data !== null) {
    return {
      type: "schema",
      // we're just retuning the data instead of the schema for now.
      data: node.data,
    };
  }

  return {
    type: "unknown",
    data: nodeDataStr(node),
  };
}

export class Graph {
  nodes: Record<string, Node> = {};

  edges: Edge[] = [];

  // Convert the graph to a JSON-serializable format.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    const stableNodeIds: Record<string, string | number> = {};
    Object.values(this.nodes).forEach((node, i) => {
      stableNodeIds[node.id] = isUuid(node.id) ? i : node.id;
    });

    return {
      nodes: Object.values(this.nodes).map((node) => ({
        id: stableNodeIds[node.id],
        ...nodeDataJson(node),
      })),
      edges: this.edges.map((edge) =>
        edge.data
          ? {
              source: stableNodeIds[edge.source],
              target: stableNodeIds[edge.target],
              data: edge.data,
            }
          : {
              source: stableNodeIds[edge.source],
              target: stableNodeIds[edge.target],
            }
      ),
    };
  }

  addNode(data: Runnable, id?: string): Node {
    if (
      id !== undefined &&
      Object.prototype.hasOwnProperty.call(this.nodes, id)
    ) {
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

  addEdge(source: Node, target: Node, data?: string): Edge {
    if (!Object.prototype.hasOwnProperty.call(this.nodes, source.id)) {
      throw new Error(`Source node ${source.id} not in graph`);
    }
    if (!Object.prototype.hasOwnProperty.call(this.nodes, target.id)) {
      throw new Error(`Target node ${target.id} not in graph`);
    }
    const edge: Edge = { source: source.id, target: target.id, data };
    this.edges.push(edge);
    return edge;
  }

  firstNode(): Node | null {
    const targets = new Set(this.edges.map((edge) => edge.target));
    const found: Node[] = [];
    Object.values(this.nodes).forEach((node) => {
      if (!targets.has(node.id)) {
        found.push(node);
      }
    });
    return found.length === 1 ? found[0] : null;
  }

  lastNode(): Node | null {
    const sources = new Set(this.edges.map((edge) => edge.source));
    const found: Node[] = [];
    Object.values(this.nodes).forEach((node) => {
      if (!sources.has(node.id)) {
        found.push(node);
      }
    });
    return found.length === 1 ? found[0] : null;
  }

  extend(graph: Graph): void {
    // Add all nodes from the other graph, taking care to avoid duplicates
    Object.entries(graph.nodes).forEach(([key, value]) => {
      this.nodes[key] = value;
    });

    // Add all edges from the other graph
    this.edges = [...this.edges, ...graph.edges];
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
}
