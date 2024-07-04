import { Edge } from "./types.js";

function _escapeNodeLabel(nodeLabel: string): string {
  // Escapes the node label for Mermaid syntax.
  return nodeLabel.replace(/[^a-zA-Z-_0-9]/g, "_");
}

// Adjusts Mermaid edge to map conditional nodes to pure nodes.
function _adjustMermaidEdge(edge: Edge, nodes: Record<string, string>) {
  const sourceNodeLabel = nodes[edge.source] ?? edge.source;
  const targetNodeLabel = nodes[edge.target] ?? edge.target;
  return [sourceNodeLabel, targetNodeLabel];
}

function _generateMermaidGraphStyles(
  nodeColors: Record<string, string>
): string {
  let styles = "";
  for (const [className, color] of Object.entries(nodeColors)) {
    styles += `\tclassDef ${className}class fill:${color};\n`;
  }
  return styles;
}

/**
 * Draws a Mermaid graph using the provided graph data
 */
export function drawMermaid(
  nodes: Record<string, string>,
  edges: Edge[],
  config?: {
    firstNodeLabel?: string;
    lastNodeLabel?: string;
    curveStyle?: string;
    withStyles?: boolean;
    nodeColors?: Record<string, string>;
    wrapLabelNWords?: number;
  }
): string {
  const {
    firstNodeLabel,
    lastNodeLabel,
    nodeColors,
    withStyles = true,
    curveStyle = "linear",
    wrapLabelNWords = 9,
  } = config ?? {};
  // Initialize Mermaid graph configuration
  let mermaidGraph = withStyles
    ? `%%{init: {'flowchart': {'curve': '${curveStyle}'}}}%%\ngraph TD;\n`
    : "graph TD;\n";
  if (withStyles) {
    // Node formatting templates
    const defaultClassLabel = "default";
    const formatDict: Record<string, string> = {
      [defaultClassLabel]: "{0}([{1}]):::otherclass",
    };
    if (firstNodeLabel !== undefined) {
      formatDict[firstNodeLabel] = "{0}[{0}]:::startclass";
    }
    if (lastNodeLabel !== undefined) {
      formatDict[lastNodeLabel] = "{0}[{0}]:::endclass";
    }

    // Add nodes to the graph
    for (const node of Object.values(nodes)) {
      const nodeLabel = formatDict[node] ?? formatDict[defaultClassLabel];
      const escapedNodeLabel = _escapeNodeLabel(node);
      const nodeParts = node.split(":");
      const nodeSplit = nodeParts[nodeParts.length - 1];
      mermaidGraph += `\t${nodeLabel
        .replace(/\{0\}/g, escapedNodeLabel)
        .replace(/\{1\}/g, nodeSplit)};\n`;
    }
  }
  let subgraph = "";
  // Add edges to the graph
  for (const edge of edges) {
    const sourcePrefix = edge.source.includes(":")
      ? edge.source.split(":")[0]
      : undefined;
    const targetPrefix = edge.target.includes(":")
      ? edge.target.split(":")[0]
      : undefined;
    // Exit subgraph if source or target is not in the same subgraph
    if (
      subgraph !== "" &&
      (subgraph !== sourcePrefix || subgraph !== targetPrefix)
    ) {
      mermaidGraph += "\tend\n";
      subgraph = "";
    }
    // Enter subgraph if source and target are in the same subgraph
    if (
      subgraph === "" &&
      sourcePrefix !== undefined &&
      sourcePrefix === targetPrefix
    ) {
      mermaidGraph = `\tsubgraph ${sourcePrefix}\n`;
      subgraph = sourcePrefix;
    }
    const [source, target] = _adjustMermaidEdge(edge, nodes);
    let edgeLabel = "";
    // Add BR every wrapLabelNWords words
    if (edge.data !== undefined) {
      let edgeData = edge.data;
      const words = edgeData.split(" ");
      // Group words into chunks of wrapLabelNWords size
      if (words.length > wrapLabelNWords) {
        edgeData = words
          .reduce((acc: string[], word: string, i: number) => {
            if (i % wrapLabelNWords === 0) acc.push("");
            acc[acc.length - 1] += ` ${word}`;
            return acc;
          }, [])
          .join("<br>");
        if (edge.conditional) {
          edgeLabel = ` -. ${edgeData} .-> `;
        } else {
          edgeLabel = ` -- ${edgeData} --> `;
        }
      }
    } else {
      if (edge.conditional) {
        edgeLabel = ` -.-> `;
      } else {
        edgeLabel = ` --> `;
      }
    }
    mermaidGraph += `\t${_escapeNodeLabel(
      source
    )}${edgeLabel}${_escapeNodeLabel(target)};\n`;
  }
  if (subgraph !== "") {
    mermaidGraph += "end\n";
  }

  // Add custom styles for nodes
  if (withStyles && nodeColors !== undefined) {
    mermaidGraph += _generateMermaidGraphStyles(nodeColors);
  }
  return mermaidGraph;
}

/**
 * Renders Mermaid graph using the Mermaid.INK API.
 */
export async function drawMermaidPng(
  mermaidSyntax: string,
  config?: {
    backgroundColor?: string;
  }
) {
  let { backgroundColor = "white" } = config ?? {};
  // Use btoa for compatibility, assume ASCII
  const mermaidSyntaxEncoded = btoa(mermaidSyntax);
  // Check if the background color is a hexadecimal color code using regex
  if (backgroundColor !== undefined) {
    const hexColorPattern = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
    if (!hexColorPattern.test(backgroundColor)) {
      backgroundColor = `!${backgroundColor}`;
    }
  }
  const imageUrl = `https://mermaid.ink/img/${mermaidSyntaxEncoded}?bgColor=${backgroundColor}`;
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(
      [
        `Failed to render the graph using the Mermaid.INK API.`,
        `Status code: ${res.status}`,
        `Status text: ${res.statusText}`,
      ].join("\n")
    );
  }
  const content = await res.blob();
  return content;
}
