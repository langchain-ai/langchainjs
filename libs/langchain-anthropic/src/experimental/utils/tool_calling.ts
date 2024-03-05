import { XMLParser, XMLBuilder } from "fast-xml-parser";

import {
  AIMessage,
  BaseMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { BasePromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  BaseLanguageModelCallOptions,
  ToolDefinition,
} from "@langchain/core/language_models/base";
import { RunnableConfig } from "@langchain/core/runnables";
import { ChatResult } from "@langchain/core/outputs";

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

export interface ChatAnthropicToolsCallOptions
  extends BaseLanguageModelCallOptions {
  tools?: ToolDefinition[];
  tool_choice?:
    | "auto"
    | {
        function: {
          name: string;
        };
        type: "function";
      };
}

type ToolInvocation = {
  tool_name: string;
  parameters: Record<string, unknown>;
};

function formatAsXMLRepresentation(tool: ToolDefinition) {
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

export const prepareAndParseToolCall = async ({
  messages,
  options,
  config,
  systemPromptTemplate = DEFAULT_TOOL_SYSTEM_PROMPT,
  stopSequences,
  llm,
}: {
  messages: BaseMessage[];
  options: ChatAnthropicToolsCallOptions;
  config?: RunnableConfig;
  systemPromptTemplate?: BasePromptTemplate;
  stopSequences: string[];
  llm: BaseChatModel;
}) => {
  let promptMessages = messages;
  let forced = false;
  let toolCall: string | undefined;
  if (options.tools !== undefined && options.tools.length > 0) {
    const content = await systemPromptTemplate.format({
      tools: `<tools>\n${options.tools
        .map(formatAsXMLRepresentation)
        .join("\n\n")}</tools>`,
    });
    if (promptMessages.length && promptMessages[0]._getType() !== "system") {
      const systemMessage = new SystemMessage({ content });
      promptMessages = [systemMessage].concat(promptMessages);
    } else {
      const systemMessage = new SystemMessage({
        content: `${content}\n\n${promptMessages[0].content}`,
      });
      promptMessages = [systemMessage].concat(promptMessages.slice(1));
    }
    // eslint-disable-next-line no-param-reassign
    options.stop = stopSequences.concat(["</function_calls>"]);
    if (options.tool_choice && options.tool_choice !== "auto") {
      toolCall = options.tool_choice.function.name;
      forced = true;
      const matchingFunction = options.tools.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool) => tool.function.name === toolCall
      );
      if (!matchingFunction) {
        throw new Error(
          `No matching function found for passed "function_call"`
        );
      }
      promptMessages = promptMessages.concat([
        new AIMessage({
          content: `<function_calls>\n<invoke><tool_name>${toolCall}</tool_name>`,
        }),
      ]);
      // eslint-disable-next-line no-param-reassign
      delete options.tool_choice;
    }
    // eslint-disable-next-line no-param-reassign
    delete options.tools;
  } else if (options.tool_choice !== undefined) {
    throw new Error(`If "tool_choice" is provided, "tools" must also be.`);
  }
  const outputMessage = await llm.invoke(promptMessages, {
    ...config,
    ...options,
  });
  const chatGenerationContent = outputMessage.content;
  if (typeof chatGenerationContent !== "string") {
    throw new Error("AnthropicFunctions does not support non-string output.");
  }

  if (forced) {
    const parser = new XMLParser();
    const result = parser.parse(
      `<function_calls>\n<invoke><tool_name>${toolCall}</tool_name>${chatGenerationContent}</function_calls>`
    );
    if (toolCall === undefined) {
      throw new Error(`Could not parse called function from model output.`);
    }
    const invocations: ToolInvocation[] = Array.isArray(
      result.function_calls?.invoke ?? []
    )
      ? result.function_calls.invoke
      : [result.function_calls.invoke];
    const responseMessageWithFunctions = new AIMessage({
      content: "",
      additional_kwargs: {
        tool_calls: invocations.map((toolInvocation, i) => ({
          id: i.toString(),
          type: "function",
          function: {
            name: toolInvocation.tool_name,
            arguments: JSON.stringify(toolInvocation.parameters),
          },
        })),
      },
    });
    return {
      generations: [{ message: responseMessageWithFunctions, text: "" }],
    };
  } else if (chatGenerationContent.includes("<function_calls>")) {
    const parser = new XMLParser();
    const result = parser.parse(`${chatGenerationContent}</function_calls>`);
    const invocations: ToolInvocation[] = Array.isArray(
      result.function_calls?.invoke ?? []
    )
      ? result.function_calls.invoke
      : [result.function_calls.invoke];
    const responseMessageWithFunctions = new AIMessage({
      content: chatGenerationContent.split("<function_calls>")[0],
      additional_kwargs: {
        tool_calls: invocations.map((toolInvocation, i) => ({
          id: i.toString(),
          type: "function",
          function: {
            name: toolInvocation.tool_name,
            arguments: JSON.stringify(toolInvocation.parameters),
          },
        })),
      },
    });
    return {
      generations: [{ message: responseMessageWithFunctions, text: "" }],
    };
  }
  return {
    generations: [{ message: outputMessage, text: outputMessage.content }],
  } as ChatResult;
};
