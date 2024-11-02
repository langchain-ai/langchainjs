import { ParseOracleDocMetadata } from "../web/oracleai.js";

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