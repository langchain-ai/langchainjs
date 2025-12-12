import { type BaseMessage } from "./base.js";
import { type AIMessage } from "./ai.js";
import { type ToolMessage } from "./tool.js";

export type MessageStringFormat = "pretty";

export function convertToFormattedString(
  message: BaseMessage,
  format: MessageStringFormat = "pretty"
): string {
  if (format === "pretty") return convertToPrettyString(message);
  return JSON.stringify(message);
}

function convertToPrettyString(message: BaseMessage): string {
  const lines: string[] = [];
  const title = ` ${
    message.type.charAt(0).toUpperCase() + message.type.slice(1)
  } Message `;
  const sepLen = Math.floor((80 - title.length) / 2);
  const sep = "=".repeat(sepLen);
  const secondSep = title.length % 2 === 0 ? sep : `${sep}=`;
  lines.push(`${sep}${title}${secondSep}`);

  // Add message type specific details
  if (message.type === "ai") {
    const aiMessage = message as AIMessage;
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      lines.push("Tool Calls:");
      for (const tc of aiMessage.tool_calls) {
        lines.push(`  ${tc.name} (${tc.id})`);
        lines.push(` Call ID: ${tc.id}`);
        lines.push("  Args:");
        for (const [key, value] of Object.entries(tc.args)) {
          lines.push(
            `    ${key}: ${
              typeof value === "object" ? JSON.stringify(value) : value
            }`
          );
        }
      }
    }
  }
  if (message.type === "tool") {
    const toolMessage = message as ToolMessage;
    if (toolMessage.name) {
      lines.push(`Name: ${toolMessage.name}`);
    }
  }

  // Add content if it's a string and not empty
  if (typeof message.content === "string" && message.content.trim()) {
    if (lines.length > 1) {
      lines.push(""); // blank line before content
    }
    lines.push(message.content);
  }

  return lines.join("\n");
}
