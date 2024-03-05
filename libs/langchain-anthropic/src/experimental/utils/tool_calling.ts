import { XMLBuilder } from "fast-xml-parser";

import { PromptTemplate } from "@langchain/core/prompts";
import { ToolDefinition } from "@langchain/core/language_models/base";

export const DEFAULT_TOOL_SYSTEM_PROMPT =
  /* #__PURE__ */ PromptTemplate.fromTemplate(`In this environment you have access to a set of tools you can use to answer the user's question.

You may call them like this:
<function_calls>
<invoke>
<tool_name>$TOOL_NAME</tool_name>
<parameters>
<$PARAMETER_NAME>$PARAMETER_VALUE</$PARAMETER_NAME>
...
</parameters>
</invoke>
</function_calls>

Here are the tools available:
{tools}`);

export type ToolInvocation = {
  tool_name: string;
  parameters: Record<string, unknown>;
};

export function formatAsXMLRepresentation(tool: ToolDefinition) {
  const builder = new XMLBuilder();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolParamProps = (tool.function.parameters as any)?.properties;
  const parameterXml = Object.keys(toolParamProps)
    .map((key) => {
      const parameterData = toolParamProps[key];
      let xml = `<parameter>
<name>${key}</name>
<type>${parameterData.type}</type>`;
      if (parameterData.description) {
        xml += `\n<description>${parameterData.description}</description>`;
      }
      if (parameterData.type === "array" && parameterData.items) {
        xml += `\n<items>${builder.build(
          parameterData.items.properties
        )}</items>`;
      }
      if (parameterData.properties) {
        xml += `\n<properties>\n${builder.build(
          parameterData.properties
        )}\n</properties>`;
      }
      return `${xml}\n</parameter>`;
    })
    .join("\n");
  return `<tool_description>
<tool_name>${tool.function.name}</tool_name>
<description>${tool.function.description}</description>
<parameters>
${parameterXml}
</parameters>
</tool_description>`;
}
