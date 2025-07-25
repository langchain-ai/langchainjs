import { Message, $MessageComplex } from "./message.js";

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

function openaiReturn(): Message<$OpenAIMessageComplex> {
  return {
    type: "user",
    content: [],
  };
}

const openaiMessage = openaiReturn();
if (openaiMessage.type === "user") {
  for (const content of openaiMessage.content) {
    if (content.type === "text") {
      // openaiOnly is a property provided by OpenAIMessageComplex
      console.log(content.openaiOnly);
      // console.log(content);
    }
  }
}

function normalReturn(): Message {
  return {
    type: "user",
    content: [],
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
