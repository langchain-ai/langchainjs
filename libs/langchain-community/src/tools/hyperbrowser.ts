import { StructuredTool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Hyperbrowser } from "@hyperbrowser/sdk";
import * as z from "zod";

const sessionOptions = z.object({
  useProxy: z
    .boolean()
    .default(false)
    .describe(
      "Whether to use a proxy. Proxy should be used only if there are issues accessing a page. Defaults to false."
    ),
  solveCaptchas: z
    .boolean()
    .default(false)
    .describe(
      "Whether to automatically solve captchas. Should be used only if there are captchas blocking a page. Defaults to false."
    ),
});

const scrapeOptions = z.object({
  formats: z
    .array(
      z
        .enum(["markdown", "html", "links", "screenshot"])
        .describe("The format to return the scraped content in")
    )
    .optional()
    .describe(
      "The array of formats to scrape from the requested page. If undefined, then defaults to only returning markdown."
    ),
});

const extractionOptions = z.object({
  prompt: z
    .string()
    .describe(
      "Instruction on what to extract. Strongly prefer providing a schema instead."
    ),
  schema: z
    .record(z.any())
    .describe(
      "Extraction schema in JSON Schema format. Strongly prefer using this to the prompt."
    ),
});

const browserAgentOptions = z.object({
  task: z.string().describe("The task to perform inside the browser"),
  maxSteps: z
    .number()
    .optional()
    .describe(
      "The maximum number of steps to perform. If uncertain, default to empty"
    ),
  sessionOptions: sessionOptions.optional(),
});

abstract class HyperbrowserToolBase extends StructuredTool {
  protected client: Hyperbrowser;

  constructor(apiKey?: string) {
    super();
    let key = apiKey ?? getEnvironmentVariable("HYPERBROWSER_API_KEY");
    this.client = new Hyperbrowser({ apiKey: key });
  }

  protected async getHyperbrowser(): Promise<Hyperbrowser> {
    if (this.client) return this.client;

    throw new Error("Hyperbrowser client not instantiated.");
  }
}

function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

export class HyperbrowserScrapingTool extends HyperbrowserToolBase {
  name = "hyperbrowser_scrape_webpage";
  schema = z.object({
    url: z.string().describe("The URL of the webpage to scrape"),
    scrapeOptions: scrapeOptions,
    sessionOptions: sessionOptions,
  });

  description =
    "Use this tool to scrape a specific page given a url. The format can be markdown, html, or all the links on the page.";

  async _call(
    input: z.infer<typeof this.schema>
  ): Promise<{ data: any; error: any }> {
    try {
      const response = await this.client.scrape.startAndWait({
        url: input.url,
        scrapeOptions: input.scrapeOptions,
        sessionOptions: input.sessionOptions,
      });
      return { data: response.data, error: response.error };
    } catch (error) {
      const message = isErrorWithMessage(error)
        ? error.message
        : typeof error === "object" && error !== null && "toString" in error
        ? error.toString()
        : JSON.stringify(error);
      return { data: undefined, error: message };
    }
  }
}

export class HyperbrowserExtractTool extends HyperbrowserToolBase {
  name = "hyperbrowser_extract_webpage";
  schema = z.object({
    url: z.string().describe("The URL of the page to scrape from"),
    extractOptions: extractionOptions,
    sessionOptions: sessionOptions.optional(),
  });

  description =
    "Use this tool to extract structured information from the current web page using Hyperbrowser. The input should include either an 'instruction' string and/or a 'schema' object representing the extraction schema in JSON Schema format.";

  async _call(
    input: z.infer<typeof this.schema>
  ): Promise<{ data: any; error: any }> {
    const { url, extractOptions, sessionOptions } = input;

    try {
      const result = await this.client.extract.startAndWait({
        urls: [url],
        schema: extractOptions.schema,
        prompt: extractOptions.prompt,
        sessionOptions: sessionOptions,
      });
      return { data: result.data, error: result.error };
    } catch (error: unknown) {
      const message = isErrorWithMessage(error)
        ? error.message
        : typeof error === "object" && error !== null && "toString" in error
        ? error.toString()
        : JSON.stringify(error);
      return { data: undefined, error: message };
    }
  }
}

export class HyperbrowserCrawlTool extends HyperbrowserToolBase {
  name = "hyperbrowser_crawl_tool";
  schema = z.object({
    url: z.string().describe("The URL of the webpage to scrape"),
    maxPages: z
      .number()
      .optional()
      .describe(
        "The maximum number of pages to crawl. If uncertain, default to empty"
      ),
    scrapeOptions: scrapeOptions,
    sessionOptions: sessionOptions,
  });

  description =
    "Use this tool to observe the current web page and retrieve possible actions using Hyperbrowser. The input can be an optional instruction string.";

  async _call(
    input: z.infer<typeof this.schema>
  ): Promise<{ data: any; error: any }> {
    try {
      const { url, maxPages, scrapeOptions, sessionOptions } = input;
      const result = await this.client.crawl.startAndWait({
        url,
        maxPages,
        scrapeOptions,
        sessionOptions,
      });
      return { data: result.data, error: result.error };
    } catch (error: unknown) {
      const message = isErrorWithMessage(error)
        ? error.message
        : typeof error === "object" && error !== null && "toString" in error
        ? error.toString()
        : JSON.stringify(error);
      return { data: undefined, error: message };
    }
  }
}

export class HyperbrowserBrowserUseTool extends HyperbrowserToolBase {
  name = "hyperbrowser_browser_use";
  schema = browserAgentOptions;
  description =
    "Use this tool to perform browser automation tasks using a fast, efficient agent optimized for explicit instructions. Best for straightforward, well-defined tasks that require precise browser interactions. Uses the Browser-Use agent.";

  async _call(
    input: z.infer<typeof this.schema>
  ): Promise<{ data: any; error: any }> {
    try {
      const { task, maxSteps, sessionOptions } = input;
      const result = await this.client.agents.browserUse.startAndWait({
        task,
        maxSteps,
        sessionOptions,
      });
      return { data: result.data?.finalResult, error: result.error };
    } catch (error: unknown) {
      const message = isErrorWithMessage(error)
        ? error.message
        : typeof error === "object" && error !== null && "toString" in error
        ? error.toString()
        : JSON.stringify(error);
      return { data: undefined, error: message };
    }
  }
}

export class HyperbrowserClaudeComputerUseTool extends HyperbrowserToolBase {
  name = "hyperbrowser_claude_computer_use";
  schema = browserAgentOptions;

  description =
    "Use this tool to perform complex browser automation tasks using Claude's advanced reasoning capabilities. Best for tasks requiring sophisticated decision-making and context understanding. Uses the Claude Computer Use agent";

  async _call(
    input: z.infer<typeof this.schema>
  ): Promise<{ data: any; error: any }> {
    try {
      const { task, maxSteps, sessionOptions } = input;
      const result = await this.client.agents.claudeComputerUse.startAndWait({
        task,
        maxSteps,
        sessionOptions,
      });
      return { data: result.data?.finalResult, error: result.error };
    } catch (error: unknown) {
      const message = isErrorWithMessage(error)
        ? error.message
        : typeof error === "object" && error !== null && "toString" in error
        ? error.toString()
        : JSON.stringify(error);
      return { data: undefined, error: message };
    }
  }
}

export class HyperbrowserOpenAIComputerUseTool extends HyperbrowserToolBase {
  name = "hyperbrowser_openai_computer_use";
  schema = browserAgentOptions;

  description =
    "Use this tool to perform browser automation tasks using OpenAI's balanced capabilities. Best for general-purpose tasks requiring reliable execution and practical reasoning. Uses the OpenAI CUA agent.";

  async _call(
    input: z.infer<typeof this.schema>
  ): Promise<{ data: any; error: any }> {
    try {
      const { task, maxSteps, sessionOptions } = input;
      const result = await this.client.agents.cua.startAndWait({
        task,
        maxSteps,
        sessionOptions,
      });
      return { data: result.data?.finalResult, error: result.error };
    } catch (error: unknown) {
      const message = isErrorWithMessage(error)
        ? error.message
        : typeof error === "object" && error !== null && "toString" in error
        ? error.toString()
        : JSON.stringify(error);
      return { data: undefined, error: message };
    }
  }
}
