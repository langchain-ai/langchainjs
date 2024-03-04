import { XMLParser, XMLBuilder } from "fast-xml-parser";

import {
  AIMessage,
  BaseMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { BasePromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { FunctionDefinition } from "@langchain/core/language_models/base";

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

function formatAsXMLRepresentation(tool: FunctionDefinition) {
  const builder = new XMLBuilder();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolParamProps = (tool.parameters as any)?.properties;
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
<tool_name>${tool.name}</tool_name>
<description>${tool.description}</description>
<parameters>
${parameterXml}
</parameters>
</tool_description>`;
}

export const prepareAndParseFunctionCall = async ({
  messages,
  options,
  runManager,
  systemPromptTemplate,
  stopSequences,
  llm,
}: {
  messages: BaseMessage[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: Record<string, any>;
  runManager?: CallbackManagerForLLMRun | undefined;
  systemPromptTemplate: BasePromptTemplate;
  stopSequences: string[];
  llm: BaseChatModel;
}) => {
  let promptMessages = messages;
  let forced = false;
  let functionCall: string | undefined;
  if (options.tools) {
    // eslint-disable-next-line no-param-reassign
    options.functions = (options.functions ?? []).concat(
      options.tools.map(convertToOpenAIFunction)
    );
  }
  if (options.functions !== undefined && options.functions.length > 0) {
    const content = await systemPromptTemplate.format({
      tools: `<tools>\n${options.functions
        .map(formatAsXMLRepresentation)
        .join("\n\n")}</tools>`,
    });
    const systemMessage = new SystemMessage({ content });
    promptMessages = [systemMessage].concat(promptMessages);
    // eslint-disable-next-line no-param-reassign
    options.stop = stopSequences.concat(["</parameters>"]);
    if (options.function_call) {
      if (typeof options.function_call === "string") {
        functionCall = JSON.parse(options.function_call).name;
      } else {
        functionCall = options.function_call.name;
      }
      forced = true;
      const matchingFunction = options.functions.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tool: any) => tool.name === functionCall
      );
      if (!matchingFunction) {
        throw new Error(
          `No matching function found for passed "function_call"`
        );
      }
      promptMessages = promptMessages.concat([
        new AIMessage({
          content: `<function_calls>\n<invoke><tool_name>${functionCall}</tool_name>`,
        }),
      ]);
      // eslint-disable-next-line no-param-reassign
      delete options.function_call;
    }
    // eslint-disable-next-line no-param-reassign
    delete options.functions;
  } else if (options.function_call !== undefined) {
    throw new Error(
      `If "function_call" is provided, "functions" must also be.`
    );
  }
  const chatResult = await llm._generate(promptMessages, options, runManager);
  const chatGenerationContent = chatResult.generations[0].message.content;
  if (typeof chatGenerationContent !== "string") {
    throw new Error("AnthropicFunctions does not support non-string output.");
  }

  if (forced) {
    const parser = new XMLParser();
    const result = parser.parse(`${chatGenerationContent}</parameters>`);
    if (functionCall === undefined) {
      throw new Error(`Could not parse called function from model output.`);
    }
    const responseMessageWithFunctions = new AIMessage({
      content: "",
      additional_kwargs: {
        function_call: {
          name: functionCall,
          arguments: result.parameters ? JSON.stringify(result.parameters) : "",
        },
      },
    });
    return {
      generations: [{ message: responseMessageWithFunctions, text: "" }],
    };
  } else if (chatGenerationContent.includes("<function_calls>")) {
    const parser = new XMLParser();
    const result = parser.parse(
      `${chatGenerationContent}</parameters>\n</invoke>\n</function_calls>`
    );
    const responseMessageWithFunctions = new AIMessage({
      content: chatGenerationContent.split("<function_calls>")[0],
      additional_kwargs: {
        function_call: {
          name: result.function_calls?.invoke?.tool_name,
          arguments: result.function_calls?.invoke?.parameters
            ? JSON.stringify(result.function_calls.invoke.parameters)
            : "",
        },
      },
    });
    return {
      generations: [{ message: responseMessageWithFunctions, text: "" }],
    };
  }
  return chatResult;
};
