import { jest } from "@jest/globals";
import { Connection, Result } from "oracledb";
import {
  ParseOracleDocMetadata,
  OracleDocLoader,
  OracleLoadFromType,
  TableRow,
} from "../web/oracleai.js";

describe("ParseOracleDocMetadata", () => {
  let parser: ParseOracleDocMetadata;

  beforeEach(() => {
    parser = new ParseOracleDocMetadata();
  });

  test("should parse title and meta tags correctly", () => {
    const htmlString =
      "<html><title>Sample Title</title><meta name='description' content='Sample Content'></html>";
    parser.parse(htmlString);
    const metadata = parser.getMetadata();
    expect(metadata).toEqual({
      title: "Sample Title",
      description: "Sample Content",
    });
  });

  test("should handle missing meta content gracefully", () => {
    const htmlString =
      "<html><title>Sample Title</title><meta name='description'></html>";
    parser.parse(htmlString);
    const metadata = parser.getMetadata();
    expect(metadata).toEqual({
      title: "Sample Title",
      description: "N/A",
    });
  });

  test("should handle multiple meta tags", () => {
    const htmlString =
      "<html><title>Sample Title</title><meta name='description' content='Sample Content'><meta name='author' content='John Doe'></html>";
    parser.parse(htmlString);
    const metadata = parser.getMetadata();
    expect(metadata).toEqual({
      title: "Sample Title",
      description: "Sample Content",
      author: "John Doe",
    });
  });

  test("should handle no title tag", () => {
    const htmlString =
      "<html><meta name='description' content='Sample Content'></html>";
    parser.parse(htmlString);
    const metadata = parser.getMetadata();
    expect(metadata).toEqual({
      description: "Sample Content",
    });
  });

  test("should handle empty html string", () => {
    const htmlString = "";
    parser.parse(htmlString);
    const metadata = parser.getMetadata();
    expect(metadata).toEqual({});
  });
});

describe("OracleDocLoader", () => {
  let executeMock: jest.Mock<(sql: string, bindVars?: any) => object>;
  let connMock: jest.Mocked<Connection>;
  let loader: OracleDocLoader;
  const baseDirPath = "./src/document_loaders/tests/example_data/oracleai";
  const baseMockData = "MockData";

  beforeEach(() => {
    executeMock = jest.fn();
    connMock = { execute: executeMock } as unknown as jest.Mocked<Connection>;
  });

  test("should load a single file properly", async () => {
    executeMock.mockImplementation(async (sql: string, bindVars?: any) => {
      if (bindVars) {
        return {
          outBinds: {
            mdata: {
              getData: jest
                .fn()
                .mockImplementation(() => bindVars.blob.val.toString()),
            },
            text: {
              getData: jest.fn().mockImplementation(() => baseMockData + 1),
            },
          },
        };
      } else {
        return {
          rows: [["MockUser"]],
        };
      }
    });

    loader = new OracleDocLoader(
      connMock,
      baseDirPath + "/example.html",
      OracleLoadFromType.FILE
    );
    const res = await loader.load();
    console.log(res);
    expect(res.length).toEqual(1);
    expect(res[0].pageContent).toEqual(baseMockData + "1");
    expect(res[0].metadata.title).toBeTruthy();
    expect(res[0].metadata.title).toEqual("Sample HTML Page");
    expect(res[0].metadata.viewport).toBeTruthy();
    expect(res[0].metadata.viewport).toEqual(
      "width=device-width, initial-scale=1.0"
    );
  });

  test("should load a directory properly", async () => {
    let doc_count = 0;
    executeMock.mockImplementation(async (sql: string, bindVars?: any) => {
      if (bindVars) {
        doc_count += 1;
        return {
          outBinds: {
            mdata: {
              getData: jest
                .fn()
                .mockImplementation(() => bindVars.blob.val.toString()),
            },
            text: {
              getData: jest
                .fn()
                .mockImplementation(() => baseMockData + doc_count),
            },
          },
        };
      } else {
        return {
          rows: [["MockUser"]],
        };
      }
    });

    loader = new OracleDocLoader(connMock, baseDirPath, OracleLoadFromType.DIR);
    const res = await loader.load();

    expect(res.length).toEqual(3);
    for (let i = 0; i < res.length; i += 1) {
      expect(res[i].pageContent).toEqual(baseMockData + (i + 1));
      if (res[i].metadata.title) {
        expect(res[i].metadata.title).toEqual("Sample HTML Page");
        expect(res[i].metadata.viewport).toBeTruthy();
        expect(res[i].metadata.viewport).toEqual(
          "width=device-width, initial-scale=1.0"
        );
      }
    }
  });

  test("loadFromTable with valid parameters", async () => {
    // Mock the execute method for the column type query
    executeMock.mockImplementationOnce(() => {
      return {
        rows: [
          { COLUMN_NAME: "COL1", DATA_TYPE: "VARCHAR2" },
          { COLUMN_NAME: "COL2", DATA_TYPE: "NUMBER" },
          { COLUMN_NAME: "COL3", DATA_TYPE: "DATE" },
        ],
      } as Result<{ COLUMN_NAME: string; DATA_TYPE: string }>;
    });

    // Mock the execute method for getting username
    executeMock.mockImplementationOnce(() => {
      return {
        rows: [{ USER: "TESTUSER" }],
      } as Result<{ USER: string }>;
    });

    // Mock the execute method for the main query
    executeMock.mockImplementationOnce(() => {
      return {
        rows: [
          {
            MDATA: {
              getData: jest
                .fn()
                .mockImplementation(
                  () =>
                    '<HTML><title>Title1</title><meta name="author" content="Author1"/></HTML>'
                ),
            },
            TEXT: "Text content 1",
            ROWID: "AAABBBCCC",
            COL1: "Value1",
            COL2: 123,
            COL3: new Date("2021-01-01"),
          },
          {
            MDATA: {
              getData: jest
                .fn()
                .mockImplementation(
                  () =>
                    '<HTML><title>Title2</title><meta name="author" content="Author2"/></HTML>'
                ),
            },
            TEXT: "Text content 2",
            ROWID: "AAABBBCCD",
            COL1: "Value2",
            COL2: 456,
            COL3: new Date("2021-02-01"),
          },
        ],
      };
    });

    const loader = new OracleDocLoader(
      connMock,
      "MYTABLE",
      OracleLoadFromType.TABLE,
      "MYSCHEMA",
      "MYCOLUMN",
      ["COL1", "COL2", "COL3"]
    );

    const documents = await loader.load();

    expect(documents).toHaveLength(2);

    expect(documents[0].pageContent).toBe("Text content 1");
    expect(documents[0].metadata).toEqual({
      title: "Title1",
      author: "Author1",
      _oid: expect.any(String),
      _rowid: "AAABBBCCC",
      COL1: "Value1",
      COL2: 123,
      COL3: new Date("2021-01-01"),
    });

    expect(documents[1].pageContent).toBe("Text content 2");
    expect(documents[1].metadata).toEqual({
      title: "Title2",
      author: "Author2",
      _oid: expect.any(String),
      _rowid: "AAABBBCCD",
      COL1: "Value2",
      COL2: 456,
      COL3: new Date("2021-02-01"),
    });
  });

  test("loadFromTable with missing owner", async () => {
    const loader = new OracleDocLoader(
      connMock,
      "MYTABLE",
      OracleLoadFromType.TABLE,
      undefined, // owner is missing
      "MYCOLUMN",
      ["COL1"]
    );

    await expect(loader.load()).rejects.toThrow(
      "Owner and column name must be specified for loading from a table"
    );
  });

  test("loadFromTable with missing column name", async () => {
    const loader = new OracleDocLoader(
      connMock,
      "MYTABLE",
      OracleLoadFromType.TABLE,
      "MYSCHEMA",
      undefined, // column name is missing
      ["COL1"]
    );

    await expect(loader.load()).rejects.toThrow(
      "Owner and column name must be specified for loading from a table"
    );
  });

  test("loadFromTable with mdata_cols exceeding 3 columns", async () => {
    const loader = new OracleDocLoader(
      connMock,
      "MYTABLE",
      OracleLoadFromType.TABLE,
      "MYSCHEMA",
      "MYCOLUMN",
      ["COL1", "COL2", "COL3", "COL4"] // 4 columns, exceeding limit
    );

    await expect(loader.load()).rejects.toThrow(
      "Exceeds the max number of columns you can request for metadata."
    );
  });

  test("loadFromTable with invalid column names in mdata_cols", async () => {
    const loader = new OracleDocLoader(
      connMock,
      "MYTABLE",
      OracleLoadFromType.TABLE,
      "MYSCHEMA",
      "MYCOLUMN",
      ["INVALID-COL1"] // invalid column name
    );

    await expect(loader.load()).rejects.toThrow(
      "Invalid column name in mdata_cols: INVALID-COL1"
    );
  });

  test("loadFromTable with mdata_cols containing unsupported data types", async () => {
    // Mock the execute method for the column type query
    executeMock.mockImplementationOnce(() => {
      return {
        rows: [
          { COLUMN_NAME: "COL1", DATA_TYPE: "CLOB" }, // Unsupported data type
        ],
      } as Result<{ COLUMN_NAME: string; DATA_TYPE: string }>;
    });

    const loader = new OracleDocLoader(
      connMock,
      "MYTABLE",
      OracleLoadFromType.TABLE,
      "MYSCHEMA",
      "MYCOLUMN",
      ["COL1"]
    );

    await expect(loader.load()).rejects.toThrow(
      "The datatype for the column COL1 is not supported"
    );
  });

  test("loadFromTable with empty table", async () => {
    // Mock the execute method for the column type query
    executeMock.mockImplementationOnce(() => {
      return {
        rows: [{ COLUMN_NAME: "COL1", DATA_TYPE: "VARCHAR2" }],
      } as Result<{ COLUMN_NAME: string; DATA_TYPE: string }>;
    });

    // Mock the execute method for getting username
    executeMock.mockImplementationOnce(() => {
      return {
        rows: [{ USER: "TESTUSER" }],
      } as Result<{ USER: string }>;
    });

    // Mock the execute method for the main query (empty result set)
    executeMock.mockImplementationOnce(() => {
      return {
        rows: [],
      } as Result<TableRow>;
    });

    const loader = new OracleDocLoader(
      connMock,
      "MYTABLE",
      OracleLoadFromType.TABLE,
      "MYSCHEMA",
      "MYCOLUMN",
      ["COL1"]
    );

    const documents = await loader.load();

    expect(documents).toHaveLength(0);
  });

  test("loadFromTable with null column data", async () => {
    // Mock the execute method for the column type query
    executeMock.mockImplementationOnce(() => {
      return {
        rows: [{ COLUMN_NAME: "COL1", DATA_TYPE: "VARCHAR2" }],
      } as Result<{ COLUMN_NAME: string; DATA_TYPE: string }>;
    });

    // Mock the execute method for getting username
    executeMock.mockImplementationOnce(() => {
      return {
        rows: [{ USER: "TESTUSER" }],
      } as Result<{ USER: string }>;
    });

    // Mock the execute method for the main query with null TEXT and MDATA
    executeMock.mockImplementationOnce(() => {
      return {
        rows: [
          {
            MDATA: null,
            TEXT: null,
            ROWID: "AAABBBCCC",
            COL1: "Value1",
          },
        ],
      } as Result<TableRow>;
    });

    const loader = new OracleDocLoader(
      connMock,
      "MYTABLE",
      OracleLoadFromType.TABLE,
      "MYSCHEMA",
      "MYCOLUMN",
      ["COL1"]
    );

    const documents = await loader.load();

    expect(documents).toHaveLength(1);

    expect(documents[0].pageContent).toBe("");
    expect(documents[0].metadata).toEqual({
      _oid: expect.any(String),
      _rowid: "AAABBBCCC",
      COL1: "Value1",
    });
  });
});
