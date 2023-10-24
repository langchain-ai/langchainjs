import { StructuredTool } from "./base.js";

export function renderTextDescription(tools: StructuredTool[]): string {
  return tools.map((tool) => `${tool.name}: ${tool.description}`).join("\n");
}

export function renderTextDescriptionAndArgs(tools: StructuredTool[]): string {
  const toolStrings: string[] = [];
  for (const tool of tools) {
    let argsSchema = "";
    if ("args" in tool) {
      argsSchema = JSON.stringify(tool.args);
    }
    toolStrings.push(
      `${tool.name}: ${tool.description}${
        argsSchema ? `, args: ${argsSchema}` : ""
      }`
    );
  }
  return toolStrings.join("\n");
}
