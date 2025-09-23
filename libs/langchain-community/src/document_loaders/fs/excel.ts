import { Document } from "@langchain/core/documents";
import { BufferLoader } from "langchain/document_loaders/fs/buffer";

type ExcelLoaderOptions = {
  /**
   * By default, all sheets are loaded. Use this option to specify which sheets to load.
   * Can be a sheet name, sheet index (0-based), or an array of names/indices.
   */
  sheets?: string | number | Array<string | number>;
  /**
   * By default, each row becomes a separate document with key-value pairs.
   * Set to "raw" to get all data as a single document per sheet.
   * Set to "html" to get data as an HTML table.
   * Set to "csv" to get data in CSV format.
   */
  outputFormat?: "json" | "raw" | "html" | "csv";
  /**
   * When outputFormat is "json" and a specific column is provided,
   * only that column's values will be used as page content.
   * Otherwise, all columns are included as key-value pairs.
   */
  column?: string;
  /**
   * Whether to include empty rows. Default is false.
   */
  includeEmptyRows?: boolean;
  /**
   * Custom row range to load (e.g., "A1:Z100").
   * If not specified, loads all rows with data.
   */
  range?: string;
  /**
   * How to handle merged cells in the Excel file.
   * - 'first': Only the first cell in a merged range has the value (default behavior)
   * - 'duplicate': Copy the value to all cells in the merged range
   * Default is 'first'.
   */
  mergedCellHandling?: "first" | "duplicate";
};

/**
 * A class that extends the `BufferLoader` class. It represents a document
 * loader that loads documents from Excel files (.xlsx, .xls).
 *
 * @example
 * ```typescript
 * // Load all sheets, each row as a document
 * const loader = new ExcelLoader("data.xlsx");
 * const docs = await loader.load();
 *
 * // Load specific sheet only
 * const loader = new ExcelLoader("data.xlsx", {
 *   sheets: "Sheet1"
 * });
 *
 * // Load specific column as page content
 * const loader = new ExcelLoader("data.xlsx", {
 *   column: "description"
 * });
 * ```
 */
export class ExcelLoader extends BufferLoader {
  protected options: ExcelLoaderOptions = {
    outputFormat: "json",
    includeEmptyRows: false,
    mergedCellHandling: "first",
  };

  constructor(filePathOrBlob: string | Blob, options?: ExcelLoaderOptions) {
    super(filePathOrBlob);
    if (options) {
      this.options = {
        ...this.options,
        ...options,
      };
    }
  }

  /**
   * Parses the Excel file buffer and returns an array of Document instances.
   * @param raw The raw buffer containing Excel file data
   * @param metadata The metadata to be associated with documents
   * @returns A promise that resolves to an array of Document instances
   */
  public async parse(
    raw: Buffer,
    metadata: Document["metadata"]
  ): Promise<Document[]> {
    const { read, utils } = await ExcelLoaderImports();

    // Read the workbook from buffer
    const workbook = read(raw, { type: "buffer" });

    // Determine which sheets to process
    const sheetsToProcess = this.getSheetsToProcess(workbook);

    const documents: Document[] = [];

    for (const sheetName of sheetsToProcess) {
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        console.warn(`Sheet "${sheetName}" not found in workbook`);
        continue;
      }

      // Get the range to process
      const range = this.options.range || worksheet["!ref"];
      if (!range) {
        console.warn(`Sheet "${sheetName}" appears to be empty`);
        continue;
      }

      // Handle merged cells if requested
      if (this.options.mergedCellHandling === "duplicate") {
        this.fillMergedCells(worksheet, utils);
      }

      const sheetMetadata = {
        ...metadata,
        sheet: sheetName,
      };

      // Process based on output format
      switch (this.options.outputFormat) {
        case "raw": {
          // Return all data as a single document per sheet
          const text = utils.sheet_to_txt(worksheet);
          if (text.trim()) {
            documents.push(
              new Document({
                pageContent: text,
                metadata: sheetMetadata,
              })
            );
          }
          break;
        }

        case "html": {
          // Return data as HTML table
          const html = utils.sheet_to_html(worksheet);
          if (html.trim()) {
            documents.push(
              new Document({
                pageContent: html,
                metadata: sheetMetadata,
              })
            );
          }
          break;
        }

        case "csv": {
          // Return data as CSV
          const csv = utils.sheet_to_csv(worksheet);
          if (csv.trim()) {
            documents.push(
              new Document({
                pageContent: csv,
                metadata: sheetMetadata,
              })
            );
          }
          break;
        }

        case "json":
        default: {
          // Parse as JSON, creating one document per row
          const jsonData = utils.sheet_to_json(worksheet, {
            raw: false,
            defval: "",
            blankrows: this.options.includeEmptyRows,
            range: this.options.range,
          });

          for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
            const row = jsonData[rowIndex] as Record<string, any>;

            // Skip empty rows if not including them
            if (!this.options.includeEmptyRows && this.isEmptyRow(row)) {
              continue;
            }

            let pageContent: string;

            if (this.options.column) {
              // Use specific column as page content
              if (!(this.options.column in row)) {
                console.warn(
                  `Column "${this.options.column}" not found in sheet "${sheetName}"`
                );
                continue;
              }
              pageContent = String(row[this.options.column] || "");
            } else {
              // Use all columns as key-value pairs
              pageContent = Object.entries(row)
                .map(([key, value]) => `${key}: ${value}`)
                .join("\n");
            }

            if (pageContent.trim()) {
              documents.push(
                new Document({
                  pageContent,
                  metadata: {
                    ...sheetMetadata,
                    row: rowIndex + 2, // +2 because Excel rows are 1-indexed and first row is usually headers
                  },
                })
              );
            }
          }
          break;
        }
      }
    }

    return documents;
  }

  /**
   * Determines which sheets to process based on options
   */
  private getSheetsToProcess(workbook: any): string[] {
    const allSheets = workbook.SheetNames;

    if (!this.options.sheets) {
      return allSheets;
    }

    const sheetsOption = this.options.sheets;

    if (Array.isArray(sheetsOption)) {
      return sheetsOption
        .map((sheet) => {
          if (typeof sheet === "number") {
            return allSheets[sheet] || "";
          }
          return sheet;
        })
        .filter(Boolean);
    }

    if (typeof sheetsOption === "number") {
      const sheetName = allSheets[sheetsOption];
      return sheetName ? [sheetName] : [];
    }

    return [sheetsOption];
  }

  /**
   * Checks if a row object is empty (all values are empty/null/undefined)
   */
  private isEmptyRow(row: Record<string, any>): boolean {
    return Object.values(row).every(
      (value) => value === null || value === undefined || value === ""
    );
  }

  /**
   * Fills merged cells with their master cell value when mergedCellHandling is 'duplicate'
   * This ensures that all cells in a merged range contain the same value
   */
  private fillMergedCells(worksheet: any, utils: any): void {
    const merges = worksheet["!merges"];
    if (!merges || merges.length === 0) {
      return;
    }

    for (const merge of merges) {
      // Get the value from the top-left cell of the merge range
      const masterCellAddress = utils.encode_cell(merge.s);
      const masterCell = worksheet[masterCellAddress];

      if (masterCell && masterCell.v !== undefined) {
        // Fill all cells in the merged range with the master cell's value
        for (let row = merge.s.r; row <= merge.e.r; row++) {
          for (let col = merge.s.c; col <= merge.e.c; col++) {
            // Skip the master cell itself
            if (row === merge.s.r && col === merge.s.c) {
              continue;
            }

            const cellAddress = utils.encode_cell({ r: row, c: col });
            // Only fill if the cell doesn't already have a value
            if (!worksheet[cellAddress]) {
              worksheet[cellAddress] = {
                t: masterCell.t, // Copy the cell type
                v: masterCell.v, // Copy the value
                w: masterCell.w, // Copy the formatted text if available
              };
            }
          }
        }
      }
    }
  }
}

async function ExcelLoaderImports() {
  try {
    const XLSX = await import("xlsx");
    return XLSX;
  } catch (e) {
    console.error(e);
    throw new Error(
      "Failed to load xlsx. Please install it with eg. `npm install xlsx`."
    );
  }
}
