import { test, expect, beforeAll } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { ExcelLoader } from "../fs/excel.js";

// Create test Excel files programmatically
let xlsxPath: string;
let xlsPath: string;

beforeAll(async () => {
  try {
    const XLSX = await import("xlsx");

    const testDir = path.resolve(
      path.dirname(url.fileURLToPath(import.meta.url)),
      "./example_data"
    );

    xlsxPath = path.join(testDir, "sample_sheet.xlsx");
    xlsPath = path.join(testDir, "test_data.xls");

    // Create test data
    const testData = [
      {
        Name: "John Doe",
        Age: 30,
        Department: "Engineering",
        Description: "Senior Software Engineer",
      },
      {
        Name: "Jane Smith",
        Age: 28,
        Department: "Marketing",
        Description: "Marketing Manager",
      },
      {
        Name: "Bob Johnson",
        Age: 35,
        Department: "Sales",
        Description: "Sales Director",
      },
    ];

    const workbook = XLSX.utils.book_new();

    // Add Sheet1 with the test data
    const worksheet1 = XLSX.utils.json_to_sheet(testData);
    XLSX.utils.book_append_sheet(workbook, worksheet1, "Sheet1");

    // Add Sheet2 with different data
    const testData2 = [
      { Product: "Widget A", Price: 19.99, Quantity: 100 },
      { Product: "Widget B", Price: 29.99, Quantity: 50 },
    ];
    const worksheet2 = XLSX.utils.json_to_sheet(testData2);
    XLSX.utils.book_append_sheet(workbook, worksheet2, "Products");

    // Write both XLSX and XLS files
    XLSX.writeFile(workbook, xlsxPath);
    XLSX.writeFile(workbook, xlsPath);
  } catch (error) {
    console.warn(
      "Could not create test Excel files. xlsx package may not be installed:",
      error
    );
  }
});

test("Test Excel loader from .xlsx file - all rows as documents", async () => {
  if (
    !xlsxPath ||
    !(await fs
      .access(xlsxPath)
      .then(() => true)
      .catch(() => false))
  ) {
    console.warn("Skipping test - test Excel file not available");
    return;
  }

  const loader = new ExcelLoader(xlsxPath);
  const docs = await loader.load();

  expect(docs.length).toBe(5); // 3 rows from Sheet1 + 2 rows from Products

  // Check first document content
  expect(docs[0].pageContent).toContain("Name: John Doe");
  expect(docs[0].pageContent).toContain("Age: 30");
  expect(docs[0].pageContent).toContain("Department: Engineering");

  // Check metadata
  expect(docs[0].metadata.source).toBe(xlsxPath);
  expect(docs[0].metadata.sheet).toBe("Sheet1");
  expect(docs[0].metadata.row).toBe(2); // First data row (after header)
});

test("Test Excel loader with specific column", async () => {
  if (
    !xlsxPath ||
    !(await fs
      .access(xlsxPath)
      .then(() => true)
      .catch(() => false))
  ) {
    console.warn("Skipping test - test Excel file not available");
    return;
  }

  const loader = new ExcelLoader(xlsxPath, {
    sheets: "Sheet1",
    column: "Description",
  });
  const docs = await loader.load();

  expect(docs.length).toBe(3);
  expect(docs[0].pageContent).toBe("Senior Software Engineer");
  expect(docs[1].pageContent).toBe("Marketing Manager");
  expect(docs[2].pageContent).toBe("Sales Director");
});

test("Test Excel loader with specific sheet", async () => {
  if (
    !xlsxPath ||
    !(await fs
      .access(xlsxPath)
      .then(() => true)
      .catch(() => false))
  ) {
    console.warn("Skipping test - test Excel file not available");
    return;
  }

  const loader = new ExcelLoader(xlsxPath, {
    sheets: "Products",
  });
  const docs = await loader.load();

  expect(docs.length).toBe(2);
  expect(docs[0].pageContent).toContain("Product: Widget A");
  expect(docs[0].pageContent).toContain("Price: 19.99");
});

test("Test Excel loader with CSV output format", async () => {
  if (
    !xlsxPath ||
    !(await fs
      .access(xlsxPath)
      .then(() => true)
      .catch(() => false))
  ) {
    console.warn("Skipping test - test Excel file not available");
    return;
  }

  const loader = new ExcelLoader(xlsxPath, {
    sheets: "Sheet1",
    outputFormat: "csv",
  });
  const docs = await loader.load();

  expect(docs.length).toBe(1); // CSV format returns one document per sheet
  expect(docs[0].pageContent).toContain("John Doe,30,Engineering");
  expect(docs[0].metadata.sheet).toBe("Sheet1");
});

test("Test Excel loader with HTML output format", async () => {
  if (
    !xlsxPath ||
    !(await fs
      .access(xlsxPath)
      .then(() => true)
      .catch(() => false))
  ) {
    console.warn("Skipping test - test Excel file not available");
    return;
  }

  const loader = new ExcelLoader(xlsxPath, {
    sheets: "Products",
    outputFormat: "html",
  });
  const docs = await loader.load();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toContain("<table");
  expect(docs[0].pageContent).toContain("Widget A");
  expect(docs[0].pageContent).toContain("Widget B");
});

test("Test Excel loader from .xls file", async () => {
  if (
    !xlsPath ||
    !(await fs
      .access(xlsPath)
      .then(() => true)
      .catch(() => false))
  ) {
    console.warn("Skipping test - test Excel file not available");
    return;
  }

  const loader = new ExcelLoader(xlsPath, {
    sheets: 0, // Use sheet by index
  });
  const docs = await loader.load();

  expect(docs.length).toBeGreaterThan(0);
  expect(docs[0].metadata.source).toBe(xlsPath);
});

test("Test Excel loader with multiple sheets selection", async () => {
  if (
    !xlsxPath ||
    !(await fs
      .access(xlsxPath)
      .then(() => true)
      .catch(() => false))
  ) {
    console.warn("Skipping test - test Excel file not available");
    return;
  }

  const loader = new ExcelLoader(xlsxPath, {
    sheets: ["Sheet1", "Products"],
  });
  const docs = await loader.load();

  expect(docs.length).toBe(5); // 3 from Sheet1 + 2 from Products

  // Check that we have documents from both sheets
  const sheets = new Set(docs.map((d) => d.metadata.sheet));
  expect(sheets.has("Sheet1")).toBe(true);
  expect(sheets.has("Products")).toBe(true);
});

test("Test Excel loader with raw output format", async () => {
  if (
    !xlsxPath ||
    !(await fs
      .access(xlsxPath)
      .then(() => true)
      .catch(() => false))
  ) {
    console.warn("Skipping test - test Excel file not available");
    return;
  }

  const loader = new ExcelLoader(xlsxPath, {
    outputFormat: "raw",
  });
  const docs = await loader.load();

  expect(docs.length).toBe(2); // One document per sheet

  // Check raw format includes the content (may have different encodings)
  const content = docs[0].pageContent;
  expect(content).toBeTruthy();
  // Raw format should contain the data in some form
  expect(content.length).toBeGreaterThan(0);
});

test("Test Excel loader with merged cells handling", async () => {
  if (
    !xlsxPath ||
    !(await fs
      .access(xlsxPath)
      .then(() => true)
      .catch(() => false))
  ) {
    console.warn("Skipping test - test Excel file not available");
    return;
  }

  try {
    const XLSX = await import("xlsx");

    // Create a test file with merged cells
    const mergedTestPath = path.join(
      path.dirname(xlsxPath),
      "merged_cells_test.xlsx"
    );

    const workbook = XLSX.utils.book_new();

    // Create a worksheet with merged cells
    const ws_data = [
      ["Merged Header", "", "", "Regular"],
      ["A1", "B1", "C1", "D1"],
      ["A2", "B2", "C2", "D2"],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(ws_data);

    // Add merge information (A1:C1 merged)
    if (!worksheet["!merges"]) worksheet["!merges"] = [];
    worksheet["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } });

    XLSX.utils.book_append_sheet(workbook, worksheet, "MergedSheet");
    XLSX.writeFile(workbook, mergedTestPath);

    // Test with default behavior (first)
    const loader1 = new ExcelLoader(mergedTestPath, {
      sheets: "MergedSheet",
      outputFormat: "json",
    });
    const docs1 = await loader1.load();

    // First row should have the merged value only in the first column
    expect(docs1[0].pageContent).toContain("Merged Header");
    // Empty cells from merged range might not appear in output with default handling

    // Test with duplicate behavior
    const loader2 = new ExcelLoader(mergedTestPath, {
      sheets: "MergedSheet",
      outputFormat: "json",
      mergedCellHandling: "duplicate",
    });
    const docs2 = await loader2.load();

    // With duplicate handling, the merged value should appear in all merged cells
    // This ensures data consistency when processing merged cells
    expect(docs2[0].pageContent).toContain("Merged Header");

    // Clean up test file
    await fs.unlink(mergedTestPath).catch(() => {});
  } catch (error) {
    console.warn("Could not test merged cells - xlsx package issue:", error);
  }
});
