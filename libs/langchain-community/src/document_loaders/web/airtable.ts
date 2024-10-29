import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

interface AirtableLoaderOptions {
  tableId: string;
  baseId: string;
  kwargs?: Record<string, any>;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

export class AirtableLoader extends BaseDocumentLoader {
  private readonly apiToken: string;

  private readonly tableId: string;

  private readonly baseId: string;

  private readonly kwargs: Record<string, any>;

  private static readonly BASE_URL = "https://api.airtable.com/v0";

  private static readonly MAX_RETRIES = 3;

  private static readonly DEFAULT_RETRY_DELAY_MS = 1000;

  private static readonly FETCH_ABORT_TIMEOUT = 10000;

  /**
   * Initializes the AirtableLoader with configuration options.
   * Retrieves the API token from environment variables and validates it.
   *
   * @param tableId - ID of the Airtable table.
   * @param baseId - ID of the Airtable base.
   * @param kwargs - Additional query parameters for Airtable requests.
   * @param config - Loader configuration for retry options.
   */
  constructor({ tableId, baseId, kwargs = {} }: AirtableLoaderOptions) {
    super();
    this.apiToken = getEnvironmentVariable("AIRTABLE_API_TOKEN") || "";
    this.tableId = tableId;
    this.baseId = baseId;
    this.kwargs = kwargs;

    if (!this.apiToken) {
      throw new Error(
        "Missing Airtable API token. Please set AIRTABLE_API_TOKEN environment variable."
      );
    }
  }

  /**
   * Loads documents from Airtable, handling pagination and retries.
   *
   * @returns A promise that resolves to an array of Document objects.
   */
  public async load(): Promise<Document[]> {
    const documents: Document[] = [];
    let offset: string | undefined;

    try {
      do {
        const url = this.constructUrl(offset);
        const data = await this.retryFetchRecords(url);
        data.records.forEach((record: AirtableRecord) =>
          documents.push(this.createDocument(record))
        );
        offset = data.offset;
      } while (offset);
    } catch (error) {
      console.error("Error loading Airtable records:", error);
      throw new Error("Failed to load Airtable records");
    }

    return documents;
  }

  /**
   * Asynchronous generator function for lazily loading documents from Airtable.
   * This method yields each document individually, enabling memory-efficient
   * handling of large datasets by fetching records in pages.
   *
   * @returns An asynchronous generator yielding Document objects one by one.
   */
  public async *loadLazy(): AsyncGenerator<Document> {
    let offset: string | undefined;
    try {
      do {
        const url = this.constructUrl(offset);
        const data = await this.retryFetchRecords(url);

        for (const record of data.records) {
          yield this.createDocument(record);
        }

        offset = data.offset;
      } while (offset);
    } catch (error) {
      console.error("Error loading Airtable records lazily:", error);
      throw new Error("Failed to load Airtable records lazily");
    }
  }

  /**
   * Fetches records from Airtable with retry logic to handle transient failures.
   *
   * @param url - The Airtable API request URL.
   * @param attempt - Current retry attempt number.
   * @returns A promise that resolves to an AirtableResponse object.
   */
  private async retryFetchRecords(
    url: string,
    attempt = 1
  ): Promise<AirtableResponse> {
    try {
      return await this.fetchRecords(url);
    } catch (error) {
      const maxRetries = AirtableLoader.MAX_RETRIES;
      const retryDelayMs = AirtableLoader.DEFAULT_RETRY_DELAY_MS;

      if (attempt <= maxRetries) {
        console.warn(
          `Attempt ${attempt} failed. Retrying in ${retryDelayMs}ms...`
        );
        await this.delay(retryDelayMs);
        return this.retryFetchRecords(url, attempt + 1);
      }
      throw new Error(`Failed to fetch records after ${maxRetries} attempts.`);
    }
  }

  /**
   * Constructs the Airtable API request URL with pagination and query parameters.
   *
   * @param offset - The pagination offset returned by the previous request.
   * @returns A fully constructed URL for the API request.
   */
  private constructUrl(offset?: string): string {
    const url = new URL(
      `${AirtableLoader.BASE_URL}/${this.baseId}/${this.tableId}`
    );
    if (offset) url.searchParams.append("offset", offset);
    if (this.kwargs.view) url.searchParams.append("view", this.kwargs.view);
    return url.toString();
  }

  /**
   * Sends the API request to Airtable and handles the response.
   * Includes a timeout to prevent hanging on unresponsive requests.
   *
   * @param url - The Airtable API request URL.
   * @returns A promise that resolves to an AirtableResponse object.
   */
  private async fetchRecords(url: string): Promise<AirtableResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      AirtableLoader.FETCH_ABORT_TIMEOUT
    );

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Airtable API request failed with status ${response.status}: ${response.statusText}`
        );
      }

      return (await response.json()) as AirtableResponse;
    } catch (error) {
      console.error("Error during fetch:", error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Converts an Airtable record into a Document object with metadata.
   *
   * @param record - An Airtable record to convert.
   * @returns A Document object with page content and metadata.
   */
  private createDocument(record: AirtableRecord): Document {
    const metadata: Record<string, any> = {
      source: `${this.baseId}_${this.tableId}`,
      base_id: this.baseId,
      table_id: this.tableId,
      ...(this.kwargs.view && { view: this.kwargs.view }),
    };
    return new Document({ pageContent: JSON.stringify(record), metadata });
  }

  /**
   * Delays execution by a specified number of milliseconds.
   *
   * @param ms - The number of milliseconds to delay.
   * @returns A promise that resolves after the specified delay.
   */
  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
