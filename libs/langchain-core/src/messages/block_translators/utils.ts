import type { ContentBlock } from "../content/index.js";

export function _isContentBlock<T extends string>(
  block: unknown,
  type: T
): block is ContentBlock & { type: T } {
  return _isObject(block) && block.type === type;
}

export function _isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function _isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function _isString(value: unknown): value is string {
  return typeof value === "string";
}

export function safeParseJson<T = unknown>(value: string): T | undefined {
  try {
    return JSON.parse(value);
  } catch (error) {
    return undefined;
  }
}

export const iife = <T>(fn: () => T): T => fn();
