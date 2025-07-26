import { ContentBlock } from "./content/index.js";
import { BaseMessage, $MessageComplex } from "./message.js";

// Example usage with OpenAI special content blocks

interface OpenAITextContentBlock {
  readonly type: "text";
  openaiOnly: number;
}

interface OpenAIMcpContentBlock {
  readonly type: "openai_mcp";
  openaiOnly: number;
}

interface $OpenAIMessageComplex extends $MessageComplex {
  content: {
    user: OpenAITextContentBlock | OpenAIMcpContentBlock;
    assistant: OpenAIMcpContentBlock;
    tool: OpenAIMcpContentBlock;
    system: OpenAIMcpContentBlock;
  };
}

function openaiReturn(): BaseMessage<$OpenAIMessageComplex> {
  return {
    type: "user",
    content: [],
    responseMetadata: {},
    usageMetadata: {},
  };
}

const openaiMessage = openaiReturn();
if (openaiMessage.type === "user") {
  for (const content of openaiMessage.content) {
    if (content.type === "text") {
      // openaiOnly is a property provided by OpenAIMessageComplex
      console.log(content.openaiOnly);
    }
  }
}

function normalReturn(): BaseMessage {
  return {
    type: "user",
    content: [],
    responseMetadata: {},
    usageMetadata: {},
  };
}

const normalMessage = normalReturn();
if (normalMessage.type === "user") {
  for (const content of normalMessage.content) {
    if (content.type === "text") {
      // @ts-expect-error - openaiOnly doesn't exist on the standard MessageComplex
      console.log(content.openaiOnly);
    }
  }
}

// Test with multiple tool call interfaces

interface ToolCallA extends ContentBlock.Tools.ToolCallContentBlock {
  name: "tool_a";
  args: {
    bar: string;
  };
}

interface ToolCallB extends ContentBlock.Tools.ToolCallContentBlock {
  name: "tool_b";
  args: {
    foo: string;
  };
}

interface TestMessageComplex extends $MessageComplex {
  content: {
    user: ToolCallA | ToolCallB;
  };
}

const testMessage = {} as BaseMessage<TestMessageComplex>;

if (testMessage.type === "user") {
  for (const content of testMessage.content) {
    if (content.type === "tool_call") {
      if (content.name === "tool_a") {
        // Bar is a property provided by ToolCallA
        console.log(content.args.bar);
      }
      if (content.name === "tool_b") {
        // Foo is a property provided by ToolCallB
        console.log(content.args.foo);
      }
      // @ts-expect-error - tool_c doesn't exist on the provided message complex
      if (content.name === "tool_c") {
        console.log(":(");
      }
    }
  }
}
