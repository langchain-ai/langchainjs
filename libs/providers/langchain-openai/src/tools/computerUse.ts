import { z } from "zod/v4";
import { OpenAI as OpenAIClient } from "openai";
import { tool } from "@langchain/core/tools";

/**
 * The type of computer environment to control.
 */
export type ComputerUseEnvironment =
  | "browser"
  | "mac"
  | "windows"
  | "linux"
  | "ubuntu";

/**
 * Re-export action types from OpenAI SDK for convenience.
 */
export type ComputerUseClickAction =
  OpenAIClient.Responses.ResponseComputerToolCall.Click;
export type ComputerUseDoubleClickAction =
  OpenAIClient.Responses.ResponseComputerToolCall.DoubleClick;
export type ComputerUseDragAction =
  OpenAIClient.Responses.ResponseComputerToolCall.Drag;
export type ComputerUseKeypressAction =
  OpenAIClient.Responses.ResponseComputerToolCall.Keypress;
export type ComputerUseMoveAction =
  OpenAIClient.Responses.ResponseComputerToolCall.Move;
export type ComputerUseScreenshotAction =
  OpenAIClient.Responses.ResponseComputerToolCall.Screenshot;
export type ComputerUseScrollAction =
  OpenAIClient.Responses.ResponseComputerToolCall.Scroll;
export type ComputerUseTypeAction =
  OpenAIClient.Responses.ResponseComputerToolCall.Type;
export type ComputerUseWaitAction =
  OpenAIClient.Responses.ResponseComputerToolCall.Wait;

/**
 * Union type of all computer use actions from OpenAI SDK.
 */
export type ComputerUseAction =
  OpenAIClient.Responses.ResponseComputerToolCall["action"];

// Zod schemas for computer use actions
const ComputerUseScreenshotActionSchema = z.object({
  type: z.literal("screenshot"),
});

const ComputerUseClickActionSchema = z.object({
  type: z.literal("click"),
  x: z.number(),
  y: z.number(),
  button: z.enum(["left", "right", "middle"]).optional(),
});

const ComputerUseDoubleClickActionSchema = z.object({
  type: z.literal("double_click"),
  x: z.number(),
  y: z.number(),
  button: z.enum(["left", "right", "middle"]).optional(),
});

const ComputerUseDragActionSchema = z.object({
  type: z.literal("drag"),
  start_x: z.number(),
  start_y: z.number(),
  end_x: z.number(),
  end_y: z.number(),
  button: z.enum(["left", "right", "middle"]).optional(),
});

const ComputerUseKeypressActionSchema = z.object({
  type: z.literal("keypress"),
  key: z.string(),
});

const ComputerUseMoveActionSchema = z.object({
  type: z.literal("move"),
  x: z.number(),
  y: z.number(),
});

const ComputerUseScrollActionSchema = z.object({
  type: z.literal("scroll"),
  x: z.number(),
  y: z.number(),
  direction: z.enum(["up", "down", "left", "right"]),
  amount: z.number(),
});

const ComputerUseTypeActionSchema = z.object({
  type: z.literal("type"),
  text: z.string(),
});

const ComputerUseWaitActionSchema = z.object({
  type: z.literal("wait"),
  duration: z.number().optional(),
});

// Discriminated union schema for all computer use actions
export const ComputerUseActionSchema = z.discriminatedUnion("type", [
  ComputerUseScreenshotActionSchema,
  ComputerUseClickActionSchema,
  ComputerUseDoubleClickActionSchema,
  ComputerUseDragActionSchema,
  ComputerUseKeypressActionSchema,
  ComputerUseMoveActionSchema,
  ComputerUseScrollActionSchema,
  ComputerUseTypeActionSchema,
  ComputerUseWaitActionSchema,
]);

// TypeScript types derived from Zod schemas
export type ComputerUseScreenshotActionType = z.infer<
  typeof ComputerUseScreenshotActionSchema
>;
export type ComputerUseClickActionType = z.infer<
  typeof ComputerUseClickActionSchema
>;
export type ComputerUseDoubleClickActionType = z.infer<
  typeof ComputerUseDoubleClickActionSchema
>;
export type ComputerUseDragActionType = z.infer<
  typeof ComputerUseDragActionSchema
>;
export type ComputerUseKeypressActionType = z.infer<
  typeof ComputerUseKeypressActionSchema
>;
export type ComputerUseMoveActionType = z.infer<
  typeof ComputerUseMoveActionSchema
>;
export type ComputerUseScrollActionType = z.infer<
  typeof ComputerUseScrollActionSchema
>;
export type ComputerUseTypeActionType = z.infer<
  typeof ComputerUseTypeActionSchema
>;
export type ComputerUseWaitActionType = z.infer<
  typeof ComputerUseWaitActionSchema
>;

/**
 * Options for the Computer Use tool.
 */
export interface ComputerUseOptions {
  /**
   * The width of the computer display in pixels.
   */
  displayWidth: number;

  /**
   * The height of the computer display in pixels.
   */
  displayHeight: number;

  /**
   * The type of computer environment to control.
   * - `browser`: Browser automation (recommended for most use cases)
   * - `mac`: macOS environment
   * - `windows`: Windows environment
   * - `linux`: Linux environment
   * - `ubuntu`: Ubuntu environment
   */
  environment: ComputerUseEnvironment;

  /**
   * Optional execute function that handles computer action execution.
   * This function receives the action input and should return a base64-encoded
   * screenshot of the result.
   *
   * If not provided, you'll need to handle action execution manually by
   * checking `computer_call` outputs in the response.
   */
  execute: (action: ComputerUseAction) => string | Promise<string>;
}

/**
 * OpenAI Computer Use tool type for the Responses API.
 */
export type ComputerUseTool = OpenAIClient.Responses.ComputerTool;

const TOOL_NAME = "computer";

/**
 * Creates a Computer Use tool that allows models to control computer interfaces
 * and perform tasks by simulating mouse clicks, keyboard input, scrolling, and more.
 *
 * **Computer Use** is a practical application of OpenAI's Computer-Using Agent (CUA)
 * model (`computer-use-preview`), which combines vision capabilities with advanced
 * reasoning to simulate controlling computer interfaces.
 *
 * **How it works**:
 * The tool operates in a continuous loop:
 * 1. Model sends computer actions (click, type, scroll, etc.)
 * 2. Your code executes these actions in a controlled environment
 * 3. You capture a screenshot of the result
 * 4. Send the screenshot back to the model
 * 5. Repeat until the task is complete
 *
 * **Important**: Computer use is in beta and requires careful consideration:
 * - Use in sandboxed environments only
 * - Do not use for high-stakes or authenticated tasks
 * - Always implement human-in-the-loop for important decisions
 * - Handle safety checks appropriately
 *
 * @see {@link https://platform.openai.com/docs/guides/tools-computer-use | OpenAI Computer Use Documentation}
 *
 * @param options - Configuration options for the Computer Use tool
 * @returns A Computer Use tool that can be passed to `bindTools`
 *
 * @example
 * ```typescript
 * import { ChatOpenAI, tools } from "@langchain/openai";
 *
 * const model = new ChatOpenAI({ model: "computer-use-preview" });
 *
 * // With execute callback for automatic action handling
 * const computer = tools.computerUse({
 *   displayWidth: 1024,
 *   displayHeight: 768,
 *   environment: "browser",
 *   execute: async (action) => {
 *     if (action.type === "screenshot") {
 *       return captureScreenshot();
 *     }
 *     if (action.type === "click") {
 *       await page.mouse.click(action.x, action.y, { button: action.button });
 *       return captureScreenshot();
 *     }
 *     if (action.type === "type") {
 *       await page.keyboard.type(action.text);
 *       return captureScreenshot();
 *     }
 *     // Handle other actions...
 *     return captureScreenshot();
 *   },
 * });
 *
 * const llmWithComputer = model.bindTools([computer]);
 * const response = await llmWithComputer.invoke(
 *   "Check the latest news on bing.com"
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Without execute callback (manual action handling)
 * const computer = tools.computerUse({
 *   displayWidth: 1024,
 *   displayHeight: 768,
 *   environment: "browser",
 * });
 *
 * const response = await model.invoke("Check the news", {
 *   tools: [computer],
 * });
 *
 * // Access the computer call from the response
 * const computerCall = response.additional_kwargs.tool_outputs?.find(
 *   (output) => output.type === "computer_call"
 * );
 * if (computerCall) {
 *   console.log("Action to execute:", computerCall.action);
 *   // Execute the action manually, then send back a screenshot
 * }
 * ```
 *
 * @example
 * ```typescript
 * // For macOS desktop automation with Docker
 * const computer = tools.computerUse({
 *   displayWidth: 1920,
 *   displayHeight: 1080,
 *   environment: "mac",
 *   execute: async (action) => {
 *     if (action.type === "click") {
 *       await dockerExec(
 *         `DISPLAY=:99 xdotool mousemove ${action.x} ${action.y} click 1`,
 *         containerName
 *       );
 *     }
 *     // Capture screenshot from container
 *     return await getDockerScreenshot(containerName);
 *   },
 * });
 * ```
 *
 * @remarks
 * - Only available through the Responses API (not Chat Completions)
 * - Requires `computer-use-preview` model
 * - Actions include: click, double_click, drag, keypress, move, screenshot, scroll, type, wait
 * - Safety checks may be returned that require acknowledgment before proceeding
 * - Use `truncation: "auto"` parameter when making requests
 * - Recommended to use with `reasoning.summary` for debugging
 */
export function computerUse(options: ComputerUseOptions) {
  const computerTool = tool(options.execute, {
    name: TOOL_NAME,
    description:
      "Control a computer interface by executing mouse clicks, keyboard input, scrolling, and other actions.",
    schema: z.toJSONSchema(ComputerUseActionSchema),
  });

  computerTool.extras = {
    ...(computerTool.extras ?? {}),
    providerToolDefinition: {
      type: "computer_use_preview",
      display_width: options.displayWidth,
      display_height: options.displayHeight,
      environment: options.environment,
    } satisfies ComputerUseTool,
  };

  return computerTool;
}
