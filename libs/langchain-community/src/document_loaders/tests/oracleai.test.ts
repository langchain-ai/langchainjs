import { jest } from "@jest/globals";
import { ParseOracleDocMetadata, OracleDocLoader, OracleLoadFromType } from "../web/oracleai.js";
import oracledb from "oracledb";

describe("ParseOracleDocMetadata", () => {
    let parser: ParseOracleDocMetadata;

    beforeEach(() => {
        parser = new ParseOracleDocMetadata();
    });

    test("should parse title and meta tags correctly", () => {
        const htmlString = "<html><title>Sample Title</title><meta name='description' content='Sample Content'></html>";
        parser.parse(htmlString);
        const metadata = parser.getMetadata();
        expect(metadata).toEqual({
            title: "Sample Title",
            description: "Sample Content",
        });
    });

    test("should handle missing meta content gracefully", () => {
        const htmlString = "<html><title>Sample Title</title><meta name='description'></html>";
        parser.parse(htmlString);
        const metadata = parser.getMetadata();
        expect(metadata).toEqual({
            title: "Sample Title",
            description: "N/A",
        });
    });

    test("should handle multiple meta tags", () => {
        const htmlString = "<html><title>Sample Title</title><meta name='description' content='Sample Content'><meta name='author' content='John Doe'></html>";
        parser.parse(htmlString);
        const metadata = parser.getMetadata();
        expect(metadata).toEqual({
            title: "Sample Title",
            description: "Sample Content",
            author: "John Doe",
        });
    });

    test("should handle no title tag", () => {
        const htmlString = "<html><meta name='description' content='Sample Content'></html>";
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
    let doc_count: number;
    let executeMock: jest.Mock<(sql: string, bindVars?: any) => {}>
    let connMock: jest.Mocked<oracledb.Connection>;
    let loader: OracleDocLoader;
    const baseDirPath = "./src/document_loaders/tests/example_data/oracleai";
    const baseMockData = "MockData"

    beforeEach(() => {
        doc_count = 0;
        executeMock = jest.fn();
        
        executeMock.mockImplementation(async (sql: string, bindVars?: {}) => {
            if (bindVars) {
              doc_count++;
              return {
                outBinds: { 
                    mdata: { getData: jest.fn().mockImplementation( () => bindVars.blob.val.toString() )  }, 
                    text: { getData: jest.fn().mockImplementation( () => baseMockData + doc_count )  } }
              };
            }
            else {
              return {
                  rows: [['MockUser']]
                };
            }
          });

        connMock = {execute: executeMock} as unknown as jest.Mocked<oracledb.Connection>;
    });

    test("should load a single file properly", async () => {
        loader = new OracleDocLoader(connMock, baseDirPath + "/example.html", OracleLoadFromType.FILE);
        const res = await loader.load();
        console.log(res)
        expect(res.length).toEqual(1);
        expect(res[0].pageContent).toEqual(baseMockData + "1");
        expect(res[0].metadata.title).toBeTruthy();
        expect(res[0].metadata.title).toEqual("Sample HTML Page");
        expect(res[0].metadata.viewport).toBeTruthy();
        expect(res[0].metadata.viewport).toEqual("width=device-width, initial-scale=1.0");
    });

    test("should load a directory properly", async () => {
        loader = new OracleDocLoader(connMock, baseDirPath, OracleLoadFromType.DIR);
        const res = await loader.load();
        
        expect(res.length).toEqual(3);
        for (let i = 0; i < res.length; i += 1) {
            expect(res[i].pageContent).toEqual(baseMockData + (i+1));
            if (res[i].metadata.title) {
                expect(res[i].metadata.title).toEqual("Sample HTML Page");
                expect(res[i].metadata.viewport).toBeTruthy();
                expect(res[i].metadata.viewport).toEqual("width=device-width, initial-scale=1.0");
            }            
        }
    });
});
