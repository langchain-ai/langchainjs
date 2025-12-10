/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from "@anthropic-ai/sdk";
import { tool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool, ToolRuntime } from "@langchain/core/tools";

import type {
  Computer20251124Action,
  Computer20250124Action,
} from "./types.js";
import {
  Computer20251124ActionSchema,
  Computer20250124ActionSchema,
} from "./types.js";

const TOOL_NAME = "computer";

export type ComputerUseReturnType =
  | string
  | Promise<string>
  | ToolMessage<any>
  | Promise<ToolMessage<any>>;

/**
 * Options for the computer use tool (Claude Opus 4.5 only version).
 *
 * @template TState - The type of the state schema (when used with `ReactAgent`)
 * @template TContext - The type of the context schema (when used with `ReactAgent`)
 */
export interface Computer20251124Options<TState = any, TContext = any> {
  /**
   * The width of the display in pixels.
   */
  displayWidthPx: number;
  /**
   * The height of the display in pixels.
   */
  displayHeightPx: number;
  /**
   * Optional display number for X11 environments.
   */
  displayNumber?: number;
  /**
   * Enable zoom action for detailed screen region inspection.
   * When enabled, Claude can zoom into specific screen regions.
   * @default false
   */
  enableZoom?: boolean;
  /**
   * Optional execute function that handles computer action execution.
   * This function receives the action input and should return the result
   * (typically a base64-encoded screenshot or action confirmation).
   */
  execute?: (
    args: Computer20251124Action,
    runtime: ToolRuntime<TState, TContext>
  ) => ComputerUseReturnType;
}

/**
 * Creates an Anthropic computer use tool for Claude Opus 4.5 that provides
 * screenshot capabilities and mouse/keyboard control for autonomous desktop interaction.
 *
 * The computer use tool enables Claude to interact with desktop environments through:
 * - **Screenshot capture**: See what's currently displayed on screen
 * - **Mouse control**: Click, drag, and move the cursor
 * - **Keyboard input**: Type text and use keyboard shortcuts
 * - **Zoom**: View specific screen regions at full resolution (when enabled)
 *
 * @warning Computer use is a beta feature with unique risks. Use a dedicated virtual machine
 * or container with minimal privileges. Avoid giving access to sensitive data.
 *
 * @see {@link https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool | Anthropic Computer Use Documentation}
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 *
 * const llm = new ChatAnthropic({
 *   model: "claude-opus-4-5-20251101",
 *   clientOptions: {
 *     defaultHeaders: {
 *       "anthropic-beta": "computer-use-2025-11-24",
 *     },
 *   },
 * });
 *
 * const computer = tools.computer_20251124({
 *   displayWidthPx: 1024,
 *   displayHeightPx: 768,
 *   displayNumber: 1,
 *   enableZoom: true,
 *   execute: async (action) => {
 *     if (action.action === "screenshot") {
 *       // Capture and return base64-encoded screenshot
 *       return captureScreenshot();
 *     }
 *     if (action.action === "left_click") {
 *       // Click at the specified coordinates
 *       await click(action.coordinate[0], action.coordinate[1]);
 *       return captureScreenshot();
 *     }
 *     // Handle other actions...
 *   },
 * });
 *
 * const llmWithComputer = llm.bindTools([computer]);
 * const response = await llmWithComputer.invoke(
 *   "Save a picture of a cat to my desktop."
 * );
 * ```
 *
 * @param options - Configuration options for the computer use tool
 * @returns The computer use tool object that can be passed to `bindTools`
 */
export function computer_20251124(options: Computer20251124Options) {
  const name = TOOL_NAME;
  const computerTool = tool(
    options.execute as (
      input: unknown,
      runtime: ToolRuntime<unknown, unknown>
    ) => ComputerUseReturnType,
    {
      name,
      schema: Computer20251124ActionSchema,
    }
  );

  computerTool.extras = {
    ...(computerTool.extras ?? {}),
    providerToolDefinition: {
      type: "computer_20251124",
      name,
      display_width_px: options.displayWidthPx,
      display_height_px: options.displayHeightPx,
      ...(options.displayNumber !== undefined && {
        display_number: options.displayNumber,
      }),
      ...(options.enableZoom !== undefined && {
        enable_zoom: options.enableZoom,
      }),
    } satisfies Anthropic.Beta.BetaToolComputerUse20251124,
  };

  return computerTool as DynamicStructuredTool<
    typeof Computer20251124ActionSchema,
    Computer20251124Action,
    any,
    ToolMessage<any>
  >;
}

/**
 * Options for the computer use tool.
 *
 * Supported models: Claude Sonnet 4.5, Haiku 4.5, Opus 4.1, Sonnet 4, Opus 4, and Sonnet 3.7 versions.
 */
export interface Computer20250124Options<TState = any, TContext = any> {
  /**
   * The width of the display in pixels.
   */
  displayWidthPx: number;
  /**
   * The height of the display in pixels.
   */
  displayHeightPx: number;
  /**
   * Optional display number for X11 environments.
   */
  displayNumber?: number;
  /**
   * Optional execute function that handles computer action execution.
   * This function receives the action input and should return the result
   * (typically a base64-encoded screenshot or action confirmation).
   */
  execute?: (
    args: Computer20250124Action,
    runtime: ToolRuntime<TState, TContext>
  ) => ComputerUseReturnType;
}

/**
 * Creates an Anthropic computer use tool that provides screenshot capabilities and mouse/keyboard control
 * for autonomous desktop interaction.
 *
 * Supported models: Claude Sonnet 4.5, Haiku 4.5, Opus 4.1, Sonnet 4, Opus 4, and Sonnet 3.7 versions.
 *
 * The computer use tool enables Claude to interact with desktop environments through:
 * - **Screenshot capture**: See what's currently displayed on screen
 * - **Mouse control**: Click, drag, and move the cursor
 * - **Keyboard input**: Type text and use keyboard shortcuts
 *
 * @warning Computer use is a beta feature with unique risks. Use a dedicated virtual machine
 * or container with minimal privileges. Avoid giving access to sensitive data.
 *
 * @see {@link https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool | Anthropic Computer Use Documentation}
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 *
 * const llm = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 *   clientOptions: {
 *     defaultHeaders: {
 *       "anthropic-beta": "computer-use-2025-01-24",
 *     },
 *   },
 * });
 *
 * const computer = tools.computer_20250124({
 *   displayWidthPx: 1024,
 *   displayHeightPx: 768,
 *   displayNumber: 1,
 *   execute: async (action) => {
 *     if (action.action === "screenshot") {
 *       // Capture and return base64-encoded screenshot
 *       return captureScreenshot();
 *     }
 *     if (action.action === "left_click") {
 *       // Click at the specified coordinates
 *       await click(action.coordinate[0], action.coordinate[1]);
 *       return captureScreenshot();
 *     }
 *     // Handle other actions...
 *   },
 * });
 *
 * const llmWithComputer = llm.bindTools([computer]);
 * const response = await llmWithComputer.invoke(
 *   "Save a picture of a cat to my desktop."
 * );
 * ```
 *
 * @param options - Configuration options for the computer use tool
 * @returns The computer use tool object that can be passed to `bindTools`
 */
export function computer_20250124(options: Computer20250124Options) {
  const name = TOOL_NAME;
  const computerTool = tool(
    options.execute as (
      input: unknown,
      runtime: ToolRuntime<unknown, unknown>
    ) => ComputerUseReturnType,
    {
      name,
      description: "A tool for interacting with the computer",
      schema: Computer20250124ActionSchema,
    }
  );

  computerTool.extras = {
    ...(computerTool.extras ?? {}),
    providerToolDefinition: {
      type: "computer_20250124",
      name,
      display_width_px: options.displayWidthPx,
      display_height_px: options.displayHeightPx,
      ...(options.displayNumber !== undefined && {
        display_number: options.displayNumber,
      }),
    } satisfies Anthropic.Beta.BetaToolComputerUse20250124,
  };

  return computerTool as DynamicStructuredTool<
    typeof Computer20250124ActionSchema,
    Computer20250124Action,
    any,
    ComputerUseReturnType
  >;
}
