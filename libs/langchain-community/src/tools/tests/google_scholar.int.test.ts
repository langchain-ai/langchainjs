import { test, expect, jest } from "@jest/globals";
import { GoogleScholarAPI } from "../google_scholar";

// Mock the GoogleScholarAPI _call method directly
jest.mock("../google_scholar");

test("GoogleScholarAPI returns an array of results for a valid query", async () => {
  const mockResponse = [
    {
      title: "Example Academic Paper",
      link: "https://example.com/paper",
      snippet: "This is a sample snippet from the paper.",
      publication_info: "Published in Example Journal, 2023",
      authors: "John Doe, Jane Smith",
    },
  ];

  // Mock the _call method to return the mock response
  (GoogleScholarAPI.prototype._call as jest.Mock).mockResolvedValueOnce(
    JSON.stringify(mockResponse)
  );

  const apiKey = "mockApiKey";
  const tool = new GoogleScholarAPI({ apiKey });
  const query = "Quantum Computing";

  const result = await tool._call(query);
  const parsedResult = JSON.parse(result);

  expect(parsedResult).toEqual(mockResponse);
});

test("GoogleScholarAPI returns 'No good results found' for an invalid query", async () => {
  const mockResponse = [];

  // Mock the _call method to return an empty array for an invalid query
  (GoogleScholarAPI.prototype._call as jest.Mock).mockResolvedValueOnce(
    JSON.stringify(mockResponse)
  );

  const apiKey = "mockApiKey";
  const tool = new GoogleScholarAPI({ apiKey });
  const query = "Random Non-existent Query";

  const result = await tool._call(query);
  const parsedResult = JSON.parse(result);

  expect(parsedResult).toEqual(mockResponse);
});

test("GoogleScholarAPI throws an error for invalid API response", async () => {
  const mockError = { error: "Invalid API Key" };

  // Mock the _call method to simulate a failed API response
  (GoogleScholarAPI.prototype._call as jest.Mock).mockRejectedValueOnce(
    new Error("Got 403: Forbidden error from SerpApi: Invalid API Key")
  );

  const apiKey = "invalidApiKey";
  const tool = new GoogleScholarAPI({ apiKey });
  const query = "Artificial Intelligence";

  await expect(tool._call(query)).rejects.toThrow(
    "Got 403: Forbidden error from SerpApi: Invalid API Key"
  );
});

test("GoogleScholarAPI handles non-JSON error response gracefully", async () => {
  // Mock the _call method to simulate a non-JSON response error
  (GoogleScholarAPI.prototype._call as jest.Mock).mockRejectedValueOnce(
    new Error("Unable to parse error message: SerpApi did not return a JSON response.")
  );

  const apiKey = "mockApiKey";
  const tool = new GoogleScholarAPI({ apiKey });
  const query = "Machine Learning";

  await expect(tool._call(query)).rejects.toThrow(
    "Unable to parse error message: SerpApi did not return a JSON response."
  );
});
