import { AIMessageChunk } from "@langchain/core/messages";
import type { ToolCallChunk } from "@langchain/core/messages/tool";

/**
 * Fix TensorRT-LLM tool-call streaming quirks:
 * - Fold same-index deltas within a single SSE event into one entry
 * - Clear `id` on continuation deltas (no `name`) so `concat()` merges by index
 *
 * See: Python `langchain-baseten._normalize_tool_call_chunks`
 */
export function normalizeToolCallChunks(
  chunks: ToolCallChunk[]
): ToolCallChunk[] {
  if (chunks.length <= 1 && (!chunks[0] || chunks[0].name)) return chunks;

  const byIndex = new Map<number, ToolCallChunk>();

  for (const tc of chunks) {
    if (tc.index == null) continue;
    const existing = byIndex.get(tc.index);
    if (!existing) {
      byIndex.set(tc.index, { ...tc });
    } else {
      byIndex.set(tc.index, {
        ...existing,
        name: existing.name ?? tc.name,
        args: (existing.args ?? "") + (tc.args ?? ""),
        id: existing.id ?? tc.id,
      });
    }
  }

  const result: ToolCallChunk[] = [];
  for (const tc of byIndex.values()) {
    if (!tc.name && tc.id != null) {
      result.push({ ...tc, id: undefined });
    } else {
      result.push(tc);
    }
  }

  return result;
}

export function chunkHasContent(message: AIMessageChunk): boolean {
  if (typeof message.content === "string" && message.content.length > 0)
    return true;
  if (Array.isArray(message.content) && message.content.length > 0) return true;
  if (message.tool_call_chunks && message.tool_call_chunks.length > 0)
    return true;
  return false;
}
