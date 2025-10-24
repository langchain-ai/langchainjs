import { XMLBuilder } from "fast-xml-parser";
import { type JsonSchema7ObjectType } from "@langchain/core/utils/json_schema";
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
{tools}

If the schema above contains a property typed as an enum, you must only return values matching an allowed value for that enum.`);

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

export function fixArrayXMLParameters(
  schema: JsonSchema7ObjectType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xmlParameters: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fixedParameters: Record<string, any> = {};

  for (const key of Object.keys(xmlParameters)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemaType = (schema.properties[key] as any).type;
    // Crawl for lists indistinguishable from single items
    if (schema.properties && schema.properties[key] && schemaType === "array") {
      const value = xmlParameters[key];
      if (Array.isArray(value)) {
        fixedParameters[key] = value;
      } else if (typeof value === "string") {
        if (value.startsWith("[") && value.endsWith("]")) {
          fixedParameters[key] = JSON.parse(value);
        } else {
          fixedParameters[key] = value.split(",");
        }
      } else {
        fixedParameters[key] = [value];
      }
      // Crawl for objects like {"item": "my string"} that should really just be "my string"
      if (
        schemaType !== "object" &&
        typeof xmlParameters[key] === "object" &&
        !Array.isArray(xmlParameters[key]) &&
        Object.keys(xmlParameters[key]).length === 1
      ) {
        // eslint-disable-next-line prefer-destructuring
        fixedParameters[key] = Object.values(xmlParameters[key])[0];
      }
    } else if (
      typeof xmlParameters[key] === "object" &&
      xmlParameters[key] !== null
    ) {
      fixedParameters[key] = fixArrayXMLParameters(
        {
          ...schema.properties[key],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          definitions: (schema as any).definitions,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        xmlParameters[key]
      );
    } else {
      fixedParameters[key] = xmlParameters[key];
    }
  }

  return fixedParameters;
}
