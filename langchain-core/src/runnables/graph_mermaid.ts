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
      (subgraph !== "" && subgraph !== sourcePrefix) ||
      subgraph !== targetPrefix
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
  if (subgraph !== undefined) {
    mermaidGraph += "end\n";
  }

  // Add custom styles for nodes
  if (withStyles && nodeColors !== undefined) {
    mermaidGraph += _generateMermaidGraphStyles(nodeColors);
  }
  return mermaidGraph;
}

// subgraph = ""
// # Add edges to the graph
// for edge in edges:
//     src_prefix = edge.source.split(":")[0] if ":" in edge.source else None
//     tgt_prefix = edge.target.split(":")[0] if ":" in edge.target else None
//     # exit subgraph if source or target is not in the same subgraph
//     if subgraph and (subgraph != src_prefix or subgraph != tgt_prefix):
//         mermaid_graph += "\tend\n"
//         subgraph = ""
//     # enter subgraph if source and target are in the same subgraph
//     if not subgraph and src_prefix and src_prefix == tgt_prefix:
//         mermaid_graph += f"\tsubgraph {src_prefix}\n"
//         subgraph = src_prefix
//     adjusted_edge = _adjust_mermaid_edge(edge=edge, nodes=nodes)

//     source, target = adjusted_edge

//     # Add BR every wrap_label_n_words words
//     if edge.data is not None:
//         edge_data = edge.data
//         words = str(edge_data).split()  # Split the string into words
//         # Group words into chunks of wrap_label_n_words size
//         if len(words) > wrap_label_n_words:
//             edge_data = "<br>".join(
//                 [
//                     " ".join(words[i : i + wrap_label_n_words])
//                     for i in range(0, len(words), wrap_label_n_words)
//                 ]
//             )
//         if edge.conditional:
//             edge_label = f" -. {edge_data} .-> "
//         else:
//             edge_label = f" -- {edge_data} --> "
//     else:
//         if edge.conditional:
//             edge_label = " -.-> "
//         else:
//             edge_label = " --> "
//     mermaid_graph += (
//         f"\t{_escape_node_label(source)}{edge_label}"
//         f"{_escape_node_label(target)};\n"
//     )
// if subgraph:
//     mermaid_graph += "end\n"

// # Add custom styles for nodes
// if with_styles:
//     mermaid_graph += _generate_mermaid_graph_styles(node_colors)
// return mermaid_graph

/**
 * Renders Mermaid graph using the Mermaid.INK API.
 */
// export async function drawMermaidPng(
//   mermaidSyntax: string,
//   config = {
//     backgroundColor: "white",
//   }
// ) {
//   let encoder = new TextEncoder();
//   let data = encoder.encode(mermaidSyntax);
//   let mermaidSyntaxEncoded = btoa(String.fromCharCode.apply(null, data));
// }

//   try:
//       import requests  # type: ignore[import]
//   except ImportError as e:
//       raise ImportError(
//           "Install the `requests` module to use the Mermaid.INK API: "
//           "`pip install requests`."
//       ) from e

//   # Use Mermaid API to render the image
//   mermaid_syntax_encoded = base64.b64encode(mermaid_syntax.encode("utf8")).decode(
//       "ascii"
//   )

//   # Check if the background color is a hexadecimal color code using regex
//   if backgroundColor is not None:
//       hex_color_pattern = re.compile(r"^#(?:[0-9a-fA-F]{3}){1,2}$")
//       if not hex_color_pattern.match(backgroundColor):
//           backgroundColor = f"!{backgroundColor}"

//   image_url = (
//       f"https://mermaid.ink/img/{mermaid_syntax_encoded}?bgColor={backgroundColor}"
//   )
//   response = requests.get(image_url)
//   if response.status_code == 200:
//       img_bytes = response.content
//       if output_file_path is not None:
//           with open(output_file_path, "wb") as file:
//               file.write(response.content)

//       return img_bytes
//   else:
//       raise ValueError(
//           f"Failed to render the graph using the Mermaid.INK API. "
//           f"Status code: {response.status_code}."
//       )
