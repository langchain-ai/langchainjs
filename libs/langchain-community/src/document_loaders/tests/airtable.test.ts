/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-process-env */
import { Document } from "@langchain/core/documents";
import { expect, jest } from "@jest/globals";
import { AirtableLoader } from "../web/airtable.js";

// Mock the global fetch function
(global as any).fetch = jest.fn();

describe("AirtableLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AIRTABLE_API_TOKEN = "foobar";
  });

  // Tests for the load method
  describe("load", () => {
    it("should load documents correctly", async () => {
      const loader = new AirtableLoader({
        tableId: "tableId",
        baseId: "baseId",
        kwargs: { view: "test-view" },
      });

      // Spy on the private fetchRecords method
      const mockFetchRecords = jest.spyOn(loader as any, "fetchRecords");

      // Mock data to be returned by fetchRecords
      const mockRecords = [
        {
          id: "rec1",
          fields: { Name: "Record 1" },
          createdTime: "2021-01-01T00:00:00.000Z",
        },
        {
          id: "rec2",
          fields: { Name: "Record 2" },
          createdTime: "2021-01-02T00:00:00.000Z",
        },
      ];

      // Mock the resolved value of fetchRecords
      mockFetchRecords.mockResolvedValue({ records: mockRecords });

      const documents = await loader.load();

      expect(documents).toHaveLength(2);
      expect(documents[0].pageContent).toBe(JSON.stringify(mockRecords[0]));
      expect(documents[1].pageContent).toBe(JSON.stringify(mockRecords[1]));
      expect(mockFetchRecords).toHaveBeenCalledTimes(1);
    });

    it("should handle pagination correctly", async () => {
      const loader = new AirtableLoader({
        tableId: "tableId",
        baseId: "baseId",
      });

      const mockFetchRecords = jest.spyOn(loader as any, "fetchRecords");
      const mockRecordsPage1 = [
        {
          id: "rec1",
          fields: { Name: "Record 1" },
          createdTime: "2021-01-01T00:00:00.000Z",
        },
      ];
      const mockRecordsPage2 = [
        {
          id: "rec2",
          fields: { Name: "Record 2" },
          createdTime: "2021-01-02T00:00:00.000Z",
        },
      ];

      // Mock fetchRecords to simulate pagination
      mockFetchRecords
        .mockResolvedValueOnce({
          records: mockRecordsPage1,
          offset: "next-page",
        })
        .mockResolvedValueOnce({ records: mockRecordsPage2 });

      const documents = await loader.load();

      expect(documents).toHaveLength(2);
      expect(documents[0].pageContent).toBe(
        JSON.stringify(mockRecordsPage1[0])
      );
      expect(documents[1].pageContent).toBe(
        JSON.stringify(mockRecordsPage2[0])
      );
      expect(mockFetchRecords).toHaveBeenCalledTimes(2);
    });

    it("should retry fetchRecords on failure", async () => {
      const loader = new AirtableLoader({
        tableId: "tableId",
        baseId: "baseId",
      });

      const mockFetchRecords = jest.spyOn(loader as any, "fetchRecords");
      const mockError = new Error("Network Error");
      const mockRecords = [
        {
          id: "rec1",
          fields: { Name: "Record 1" },
          createdTime: "2021-01-01T00:00:00.000Z",
        },
      ];

      // Simulate a failure on the first call and success on the second
      mockFetchRecords
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({ records: mockRecords });

      const documents = await loader.load();

      expect(documents).toHaveLength(1);
      expect(documents[0].pageContent).toBe(JSON.stringify(mockRecords[0]));
      expect(mockFetchRecords).toHaveBeenCalledTimes(2);
    });
  });

  // Tests for the loadLazy method
  describe("loadLazy", () => {
    it("should yield documents correctly", async () => {
      const loader = new AirtableLoader({
        tableId: "tableId",
        baseId: "baseId",
      });

      const mockFetchRecords = jest.spyOn(loader as any, "fetchRecords");
      const mockRecords = [
        {
          id: "rec1",
          fields: { Name: "Record 1" },
          createdTime: "2021-01-01T00:00:00.000Z",
        },
        {
          id: "rec2",
          fields: { Name: "Record 2" },
          createdTime: "2021-01-02T00:00:00.000Z",
        },
      ];

      mockFetchRecords.mockResolvedValue({ records: mockRecords });

      const documents: Document[] = [];
      for await (const doc of loader.loadLazy()) {
        documents.push(doc);
      }

      expect(documents).toHaveLength(2);
      expect(documents[0].pageContent).toBe(JSON.stringify(mockRecords[0]));
      expect(documents[1].pageContent).toBe(JSON.stringify(mockRecords[1]));
      expect(mockFetchRecords).toHaveBeenCalledTimes(1);
    });

    it("should handle errors in loadLazy", async () => {
      const loader = new AirtableLoader({
        tableId: "tableId",
        baseId: "baseId",
      });

      const mockFetchRecords = jest.spyOn(loader as any, "fetchRecords");
      const mockError = new Error("Network Error");

      mockFetchRecords.mockRejectedValue(mockError);

      const iterator = loader.loadLazy();
      await expect(iterator.next()).rejects.toThrow(
        "Failed to load Airtable records lazily"
      );
      expect(mockFetchRecords).toHaveBeenCalled();
    });
  });
});
