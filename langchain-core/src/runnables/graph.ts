import { v4 as uuidv4, validate as isUuid } from "uuid";
import { Runnable } from "./base.js";

interface Edge {
  source: string;
  target: string;
  data?: string;
}

interface Node {
  id: string;
  data: any;
}

function nodeDataStr(node: Node): string {
  if (!isUuid(node.id)) {
    return node.id;
  } else {
    // Assuming `node.data` has a similar structure to the Python version
    let data = node.data.toString();
    if (
      data.startsWith("<") ||
      data[0] !== data[0].toUpperCase() ||
      data.includes("\n")
    ) {
      data = node.data.constructor.name;
    } else if (data.length > 42) {
      data = `${data.substring(0, 42)}...`;
    }
    return data.startsWith("Runnable") ? data.substring(8) : data;
  }
}

function nodeDataJson(node: Node): any {
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
  toJson(): Record<string, Array<Record<string, any>>> {
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

  addNode(data: any, id?: string): Node {
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
}
