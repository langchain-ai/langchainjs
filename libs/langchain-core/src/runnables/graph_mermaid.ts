import { Edge, Node } from "./types.js";
import { toBase64Url } from "./utils.js";

function _escapeNodeLabel(nodeLabel: string): string {
  // Escapes the node label for Mermaid syntax.
  return nodeLabel.replace(/[^a-zA-Z-_0-9]/g, "_");
}

const MARKDOWN_SPECIAL_CHARS = ["*", "_", "`"];

function _generateMermaidGraphStyles(
  nodeColors: Record<string, string>
): string {
  let styles = "";
  for (const [className, color] of Object.entries(nodeColors)) {
    styles += `\tclassDef ${className} ${color};\n`;
  }
  return styles;
}

/**
 * Draws a Mermaid graph using the provided graph data
 */
export function drawMermaid(
  nodes: Record<string, Node>,
  edges: Edge[],
  config?: {
    firstNode?: string;
    lastNode?: string;
    curveStyle?: string;
    withStyles?: boolean;
    nodeColors?: Record<string, string>;
    wrapLabelNWords?: number;
  }
): string {
  const {
    firstNode,
    lastNode,
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
      [defaultClassLabel]: "{0}({1})",
    };
    if (firstNode !== undefined) {
      formatDict[firstNode] = "{0}([{1}]):::first";
    }
    if (lastNode !== undefined) {
      formatDict[lastNode] = "{0}([{1}]):::last";
    }

    // Add nodes to the graph
    for (const [key, node] of Object.entries(nodes)) {
      const nodeName = node.name.split(":").pop() ?? "";
      const label = MARKDOWN_SPECIAL_CHARS.some(
        (char) => nodeName.startsWith(char) && nodeName.endsWith(char)
      )
        ? `<p>${nodeName}</p>`
        : nodeName;

      let finalLabel = label;
      if (Object.keys(node.metadata ?? {}).length) {
        finalLabel += `<hr/><small><em>${Object.entries(node.metadata ?? {})
          .map(([k, v]) => `${k} = ${v}`)
          .join("\n")}</em></small>`;
      }

      const nodeLabel = (formatDict[key] ?? formatDict[defaultClassLabel])
        .replace("{0}", _escapeNodeLabel(key))
        .replace("{1}", finalLabel);

      mermaidGraph += `\t${nodeLabel}\n`;
    }
  }

  // Group edges by their common prefixes
  const edgeGroups: Record<string, Edge[]> = {};
  for (const edge of edges) {
    const srcParts = edge.source.split(":");
    const tgtParts = edge.target.split(":");
    const commonPrefix = srcParts
      .filter((src, i) => src === tgtParts[i])
      .join(":");
    if (!edgeGroups[commonPrefix]) {
      edgeGroups[commonPrefix] = [];
    }
    edgeGroups[commonPrefix].push(edge);
  }

  const seenSubgraphs = new Set<string>();

  // sort prefixes by path length for correct nesting
  function sortPrefixesByDepth(prefixes: string[]): string[] {
    return [...prefixes].sort((a, b) => {
      return a.split(":").length - b.split(":").length;
    });
  }

  function addSubgraph(edges: Edge[], prefix: string): void {
    const selfLoop = edges.length === 1 && edges[0].source === edges[0].target;
    if (prefix && !selfLoop) {
      const subgraph = prefix.split(":").pop()!;

      if (seenSubgraphs.has(prefix)) {
        throw new Error(
          `Found duplicate subgraph '${subgraph}' at '${prefix} -- this likely means that ` +
            "you're reusing a subgraph node with the same name. " +
            "Please adjust your graph to have subgraph nodes with unique names."
        );
      }

      seenSubgraphs.add(prefix);
      mermaidGraph += `\tsubgraph ${subgraph}\n`;
    }

    // all nested prefixes for this level, sorted by depth
    const nestedPrefixes = sortPrefixesByDepth(
      Object.keys(edgeGroups).filter(
        (nestedPrefix) =>
          nestedPrefix.startsWith(`${prefix}:`) &&
          nestedPrefix !== prefix &&
          nestedPrefix.split(":").length === prefix.split(":").length + 1
      )
    );

    for (const nestedPrefix of nestedPrefixes) {
      addSubgraph(edgeGroups[nestedPrefix], nestedPrefix);
    }

    for (const edge of edges) {
      const { source, target, data, conditional } = edge;

      let edgeLabel = "";
      if (data !== undefined) {
        let edgeData = data;
        const words = edgeData.split(" ");
        if (words.length > wrapLabelNWords) {
          edgeData = Array.from(
            { length: Math.ceil(words.length / wrapLabelNWords) },
            (_, i) =>
              words
                .slice(i * wrapLabelNWords, (i + 1) * wrapLabelNWords)
                .join(" ")
          ).join("&nbsp;<br>&nbsp;");
        }
        edgeLabel = conditional
          ? ` -. &nbsp;${edgeData}&nbsp; .-> `
          : ` -- &nbsp;${edgeData}&nbsp; --> `;
      } else {
        edgeLabel = conditional ? " -.-> " : " --> ";
      }

      mermaidGraph += `\t${_escapeNodeLabel(
        source
      )}${edgeLabel}${_escapeNodeLabel(target)};\n`;
    }

    if (prefix && !selfLoop) {
      mermaidGraph += "\tend\n";
    }
  }

  // Start with the top-level edges (no common prefix)
  addSubgraph(edgeGroups[""] ?? [], "");

  // Add remaining top-level subgraphs
  for (const prefix in edgeGroups) {
    if (!prefix.includes(":") && prefix !== "") {
      addSubgraph(edgeGroups[prefix], prefix);
    }
  }

  // Add custom styles for nodes
  if (withStyles) {
    mermaidGraph += _generateMermaidGraphStyles(nodeColors ?? {});
  }

  return mermaidGraph;
}

/**
 * Renders Mermaid graph using the Mermaid.INK API.
 *
 * @example
 * ```javascript
 * const image = await drawMermaidImage(mermaidSyntax, {
 *   backgroundColor: "white",
 *   imageType: "png",
 * });
 * fs.writeFileSync("image.png", image);
 * ```
 *
 * @param mermaidSyntax - The Mermaid syntax to render.
 * @param config - The configuration for the image.
 * @returns The image as a Blob.
 */
export async function drawMermaidImage(
  mermaidSyntax: string,
  config?: {
    /**
     * The type of image to render.
     * @default "png"
     */
    imageType?: "png" | "jpeg" | "webp";
    backgroundColor?: string;
  }
) {
  let backgroundColor = config?.backgroundColor ?? "white";
  const imageType = config?.imageType ?? "png";

  const mermaidSyntaxEncoded = toBase64Url(mermaidSyntax);

  // Check if the background color is a hexadecimal color code using regex
  if (backgroundColor !== undefined) {
    const hexColorPattern = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
    if (!hexColorPattern.test(backgroundColor)) {
      backgroundColor = `!${backgroundColor}`;
    }
  }
  const imageUrl = `https://mermaid.ink/img/${mermaidSyntaxEncoded}?bgColor=${backgroundColor}&type=${imageType}`;
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
