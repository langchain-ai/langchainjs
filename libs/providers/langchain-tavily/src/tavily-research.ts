import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { StructuredTool, ToolParams } from "@langchain/core/tools";
import { z } from "zod/v3";
import { InferInteropZodOutput } from "@langchain/core/dist/utils/types/zod.js";
import {
  TavilyResearchAPIWrapper,
  type TavilyResearchQueueResponse,
} from "./utils.js";

export type ResearchModel = "mini" | "pro" | "auto";
export type CitationFormat = "numbered" | "mla" | "apa" | "chicago";

export type TavilyResearchAPIRetrieverFields = ToolParams & {
  /**
   * The base URL to be used for the Tavily Research API.
   */
  apiBaseUrl?: string;

  /**
   * The API key used for authentication with the Tavily Research API.
   */
  tavilyApiKey?: string;

  /**
   * The model used by the research agent.
   *
   * @default "auto"
   */
  model?: ResearchModel;

  /**
   * A JSON Schema object that defines the structure of the research output. 
   * When provided, the research response will be structured to match this schema, ensuring a predictable and validated output shape. 
   * Must include a 'properties' field, and may optionally include 'required' field.
   * 
   * Example:
   * 
   * ```json
   * {
      "properties": {
        "company": {
          "type": "string",
          "description": "The name of the company"
        },
        "key_metrics": {
          "type": "array",
          "description": "List of key performance metrics",
          "items": { "type": "string" }
        },
        "financial_details": {
          "type": "object",
          "description": "Detailed financial breakdown",
          "properties": {
            "operating_income": {
              "type": "number",
              "description": "Operating income for the period"
            }
          }
        }
      },
      "required": ["company"]
    }
   * ```json
   */
  outputSchema?: Record<string, unknown>;

  /**
   * Whether to stream the research results as they are generated.
   * When 'true', returns a Server-Sent Events (SSE) stream
   *
   * @default false
   */
  stream?: boolean;

  /**
   * The format for citations in the research report.
   *
   * @default "numbered"
   */
  citationFormat?: CitationFormat;

  /**
   * The name of the tool.
   *
   * @default "tavily_research"
   */
  name?: string;

  /**
   * The description of the tool.
   *
   * @default "Performs comprehensive research on a given topic using the Tavily Research API. Useful for when you need to answer complex questions or gather in-depth information about a subject. Input should be a research task or question."
   */
  description?: string;

  /**
   * Whether to return the tool's output directly.
   *
   * Setting this to true means that after the tool is called,
   * an agent should stop looping.
   *
   * @default false
   */
  returnDirect?: boolean;

  /**
   * An API wrapper that can be used to interact with the Tavily Research API. Useful for testing.
   *
   * If specified, the tool will use this API wrapper instead of creating a new one, and fields used
   * in API Wrapper initialization, like {@link TavilyResearchAPIRetrieverFields.tavilyApiKey}, will be
   * ignored.
   */
  apiWrapper?: TavilyResearchAPIWrapper;
};

const outputSchemaPropertySchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    type: z.enum(["object", "string", "integer", "number", "array"]).optional(),
    description: z.string().optional(),
    properties: z
      .record(
        // Recursive definition: nested properties use the same schema shape
        outputSchemaPropertySchema
      )
      .optional(),
    items: z
      .object({
        type: z.enum(["object", "string", "integer", "number", "array"]),
      })
      .optional(),
  })
);

const inputSchema = z.object({
  input: z.string().describe("The research task or question to investigate."),
  model: z
    .enum(["mini", "pro", "auto"])
    .optional()
    .describe(
      `The model used by the research agent. 
      "mini" is optimized for targeted, efficient research and works best for narrow or well-scoped questions. 
      "pro" provides comprehensive, multi-angle research and is suited for complex topics that span multiple subtopics or domains.
      "auto" lets Tavily automatically determine the appropriate model based on the task complexity.
      Default is "auto".
      `
    ),
  outputSchema: z
    .object({
      properties: z.record(outputSchemaPropertySchema),
      required: z.array(z.string()).optional(),
    })
    .optional()
    .describe(
      `
      A JSON Schema object that defines the structure of the research output. 
      When provided, the research response will be structured to match this schema, ensuring a predictable and validated output shape. 
      Must include a 'properties' field, and may optionally include 'required' field.
      `
    ),
  stream: z
    .boolean()
    .optional()
    .describe(
      `Whether to stream the research results as they are generated. 
      When 'true', returns a Server-Sent Events (SSE) stream.
      Default is false.
      `
    ),
  citationFormat: z
    .enum(["numbered", "mla", "apa", "chicago"])
    .optional()
    .describe(
      `The format for citations in the research report.
      Default is "numbered".`
    ),
});
/**
 * A Tool for performing comprehensive research with the Tavily Research API.
 * Extends the StructuredTool class and provides an intelligent research agent
 * that can answer complex questions and gather in-depth information.
 *
 * Authentication is handled via an API key, which can be passed during
 * instantiation or set as an environment variable `TAVILY_API_KEY`.
 *
 * Example:
 * ```typescript
 * const tool = new TavilyResearch({
 *   model: "pro",
 *   citationFormat: "apa",
 *   tavilyApiKey: "YOUR_API_KEY"
 * });
 * const results = await tool.invoke({
 *   input: "What are the latest developments in quantum computing?"
 * });
 * console.log(results);
 * ```
 */
export class TavilyResearch extends StructuredTool<typeof inputSchema> {
  static lc_name(): string {
    return "TavilyResearch";
  }

  override description: string =
    "Performs comprehensive research on a given topic using the Tavily Research API. " +
    "This tool uses an intelligent research agent that can answer complex questions, " +
    "gather in-depth information from multiple sources, and provide structured outputs. " +
    "Useful for when you need to answer complex questions or gather comprehensive " +
    "information about a subject. Input should be a research task or question.";

  override name: string = "tavily_research";

  override schema = inputSchema;

  apiBaseUrl?: string;

  model?: ResearchModel;

  outputSchema?: Record<string, unknown>;

  enableStream?: boolean;

  citationFormat?: CitationFormat;

  private apiWrapper: TavilyResearchAPIWrapper;

  constructor(params: TavilyResearchAPIRetrieverFields = {}) {
    super(params);

    if (typeof params.name === "string") {
      this.name = params.name;
    }

    if (typeof params.description === "string") {
      this.description = params.description;
    }

    if (params.apiWrapper) {
      this.apiWrapper = params.apiWrapper;
    } else {
      const apiWrapperParams: { tavilyApiKey?: string; apiBaseUrl?: string } =
        {};
      if (params.tavilyApiKey) {
        apiWrapperParams.tavilyApiKey = params.tavilyApiKey;
      }
      if (params.apiBaseUrl) {
        apiWrapperParams.apiBaseUrl = params.apiBaseUrl;
      }
      this.apiWrapper = new TavilyResearchAPIWrapper(apiWrapperParams);
    }

    this.model = params.model;
    this.outputSchema = params.outputSchema;
    this.enableStream = params.stream;
    this.citationFormat = params.citationFormat;
  }

  async _call(
    input: InferInteropZodOutput<typeof inputSchema>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<
    | TavilyResearchQueueResponse
    | AsyncGenerator<Buffer, void, unknown>
    | { error: string }
  > {
    try {
      const {
        input: inputValue,
        model,
        outputSchema,
        stream,
        citationFormat,
      } = input;

      const effectiveModel = this.model ?? model ?? "auto";
      const effectiveOutputSchema = this.outputSchema ?? outputSchema;
      const effectiveStream = this.enableStream ?? stream ?? false;
      const effectiveCitationFormat =
        this.citationFormat ?? citationFormat ?? "numbered";

      const result = await this.apiWrapper.rawResults({
        input: inputValue,
        model: effectiveModel,
        outputSchema: effectiveOutputSchema,
        stream: effectiveStream,
        citationFormat: effectiveCitationFormat,
      });

      if (effectiveStream) {
        return result as AsyncGenerator<Buffer, void, unknown>;
      }

      const queueResponse = result as TavilyResearchQueueResponse;
      if (
        !queueResponse ||
        typeof queueResponse !== "object" ||
        !("request_id" in queueResponse)
      ) {
        const errorMessage =
          `Invalid research queue response for '${inputValue}'. ` +
          `Please try rephrasing your research question or adjusting the model.`;

        throw new Error(errorMessage);
      }

      return queueResponse;
    } catch (e: unknown) {
      const errorMessage =
        e && typeof e === "object" && "message" in e ? e.message : String(e);
      return { error: errorMessage as string };
    }
  }
}
