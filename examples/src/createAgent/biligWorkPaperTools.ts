import { createAgent, tool } from "langchain";
import { z } from "zod";
import {
  WorkPaper,
  createWorkPaperFromDocument,
  exportWorkPaperDocument,
  parseWorkPaperDocument,
  serializeWorkPaperDocument,
} from "@bilig/workpaper";

type RawCellContent = string | number | boolean | null;

type SummaryRow = {
  metric: unknown;
  value: unknown;
  formula: unknown;
};

function buildQuoteWorkPaper() {
  return WorkPaper.buildFromSheets({
    Inputs: [
      ["Metric", "Value"],
      ["Qualified opportunities", 20],
      ["Win rate", 0.25],
      ["Average ARR", 12000],
      ["Expansion multiplier", 1.1],
    ],
    Summary: [
      ["Metric", "Value"],
      ["Expected customers", "=Inputs!B2*Inputs!B3"],
      ["Expected ARR", "=B2*Inputs!B4"],
      ["Expansion ARR", "=B3*Inputs!B5"],
      ["Target gap", "=B4-100000"],
    ],
  });
}

function readSummaryRows(workbook: WorkPaper): SummaryRow[] {
  const range = workbook.simpleCellRangeFromString("Summary!A1:B5");
  if (!range) {
    throw new Error("Summary range is invalid.");
  }

  const values = workbook.getRangeValues(range).slice(1);
  const formulas = workbook.getRangeSerialized(range).slice(1);

  return values.map((row, index) => {
    const [metric, value] = row;
    const [, formula] = formulas[index] ?? [];

    return {
      metric: cellValue(metric),
      value: cellValue(value),
      formula,
    };
  });
}

function createWorkPaperTools(workbook: WorkPaper) {
  const readSummary = tool(
    async () => ({
      range: "Summary!A1:B5",
      rows: readSummaryRows(workbook),
    }),
    {
      name: "read_workpaper_summary",
      description:
        "Read calculated quote summary values and formula contracts from the WorkPaper.",
      schema: z.object({}),
    }
  );

  const setInputCell = tool(
    async ({ address, value }: { address: string; value: RawCellContent }) => {
      const inputsSheet = workbook.getSheetId("Inputs");
      if (inputsSheet === undefined) {
        throw new Error("Inputs sheet is missing.");
      }

      const cell = workbook.simpleCellAddressFromString(address, inputsSheet);
      if (!cell) {
        throw new Error(`Invalid Inputs cell address: ${address}`);
      }

      const before = readSummaryRows(workbook);
      const previousValue = workbook.getCellSerialized(cell);

      workbook.setCellContents(cell, value);

      const after = readSummaryRows(workbook);
      const serialized = serializeWorkPaperDocument(
        exportWorkPaperDocument(workbook, { includeConfig: true })
      );
      const restored = createWorkPaperFromDocument(
        parseWorkPaperDocument(serialized)
      );
      const restoredAfter = readSummaryRows(restored);

      return {
        editedCell: `Inputs!${address}`,
        previousValue,
        newValue: workbook.getCellSerialized(cell),
        before,
        after,
        afterRestore: restoredAfter,
        persistedDocumentBytes: serialized.length,
        restoredMatchesAfter:
          JSON.stringify(restoredAfter) === JSON.stringify(after),
      };
    },
    {
      name: "set_workpaper_input_cell",
      description:
        "Set one WorkPaper input cell, recalculate dependent formulas, persist JSON, and verify restored formula readback.",
      schema: z.object({
        address: z
          .string()
          .describe("A single A1 address in the Inputs sheet, for example B3."),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      }),
    }
  );

  return {
    readSummary,
    setInputCell,
  };
}

export async function run() {
  const workbook = buildQuoteWorkPaper();
  const { readSummary, setInputCell } = createWorkPaperTools(workbook);

  createAgent({
    model: "openai:gpt-4o-mini",
    tools: [readSummary, setInputCell],
    systemPrompt:
      "You help users update formula-backed WorkPapers. Always read calculated outputs after editing inputs.",
  });

  console.log("Agent configured with WorkPaper tools:", [
    "read_workpaper_summary",
    "set_workpaper_input_cell",
  ]);
  console.log("Initial summary:", await readSummary.invoke({}));
  console.log(
    "Edit proof:",
    await setInputCell.invoke({
      address: "B3",
      value: 0.4,
    })
  );
  console.log("Updated summary:", await readSummary.invoke({}));
}

function cellValue(cell: unknown) {
  if (typeof cell === "object" && cell !== null && "value" in cell) {
    return (cell as { value: unknown }).value;
  }

  return cell;
}
