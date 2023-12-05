import { Document } from "../document.js";
import {
  CallbackManager,
  Callbacks,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import { Runnable } from "../schema/runnable/base.js";
import { RunnableConfig } from "../schema/runnable/config.js";
import {
  VectaraStore,
  VectaraSummary,
  VectaraFilter,
  DEFAULT_FILTER,
} from "../vectorstores/vectara.js";

export interface VectaraRetrieverInput {
  vectara: VectaraStore;
  topK: number;
  summaryConfig?: VectaraSummary;
  callbacks?: Callbacks;
  tags?: string[];
  metadata?: Record<string, unknown>;
  verbose?: boolean;
}

export class VectaraSummaryRetriever extends Runnable<string, Document[]> {
  static lc_name() {
    return "VectaraSummaryRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "vectaraSummaryRetriever"];

  callbacks?: Callbacks;

  tags?: string[];

  metadata?: Record<string, unknown>;

  verbose?: boolean;

  private vectara: VectaraStore;

  private topK: number;

  private summaryConfig: VectaraSummary;

  constructor(fields: VectaraRetrieverInput) {
    super(fields);
    this.callbacks = fields?.callbacks;
    this.tags = fields?.tags ?? [];
    this.metadata = fields?.metadata ?? {};
    this.verbose = fields?.verbose ?? false;
    this.vectara = fields.vectara;
    this.topK = fields.topK ?? 10;
    this.summaryConfig = fields.summaryConfig ?? {
      enabled: false,
      maxSummarizedResults: 0,
      responseLang: "eng",
    };
  }

  async invoke(input: string, options?: RunnableConfig): Promise<Document[]> {
    return this.getRelevantDocuments(input, options);
  }

  async getRelevantDocuments(
    query: string,
    config: VectaraFilter = DEFAULT_FILTER,
    summary = false
  ): Promise<Document[]> {
    const parsedConfig = parseCallbackConfigArg(config);
    const callbackManager_ = await CallbackManager.configure(
      parsedConfig.callbacks,
      this.callbacks,
      parsedConfig.tags,
      this.tags,
      parsedConfig.metadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const runManager = await callbackManager_?.handleRetrieverStart(
      this.toJSON(),
      query,
      undefined,
      undefined,
      undefined,
      undefined,
      parsedConfig.runName
    );
    try {
      return this.vectara
        .vectaraQuery(
          query,
          this.topK,
          config,
          summary ? this.summaryConfig : undefined
        )
        .then((summaryResult) => {
          const docs = summaryResult.documents;
          if (summary) {
            this.summaryConfig.enabled = true;
            docs.push(
              new Document({
                pageContent: summaryResult.summary,
                metadata: { summary: true },
              })
            );
          }
          runManager
            ?.handleRetrieverEnd(docs)
            .then(() => {})
            .catch((error) => {
              throw error;
            });
          return docs;
        })
        .catch((error) => {
          // Handle any errors here
          console.error("Error during query:", error);
          throw error;
        });
    } catch (error) {
      await runManager?.handleRetrieverError(error);
      throw error;
    }
  }
}
