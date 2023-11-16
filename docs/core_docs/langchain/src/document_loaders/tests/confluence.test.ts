import { test, jest, expect } from "@jest/globals";
import {
  ConfluencePagesLoader,
  ConfluenceAPIResponse,
} from "../web/confluence.js";

type TestConfluencePagesLoaderType = ConfluencePagesLoader & {
  fetchConfluenceData: (url: string) => Promise<ConfluenceAPIResponse>;
};

test("Test ConfluenceLoader and fetchConfluenceData calls", async () => {
  // Stub the fetchConfluenceData method to return a fake response
  // As the Confluence API requires authentication
  const fakeResponse = [
    {
      id: "1",
      title: "Page 1",
      body: { storage: { value: "<p>Content of Page 1</p>" } },
    },
    {
      id: "2",
      title: "Page 2",
      body: { storage: { value: "<p>Content of Page 2</p>" } },
    },
  ];

  // Initialize the loader and load the documents
  const loader = new ConfluencePagesLoader({
    baseUrl: "https://example.atlassian.net/wiki",
    spaceKey: "SPACEKEY",
    username: "username@email.com",
    accessToken: "accessToken",
  }) as TestConfluencePagesLoaderType;

  // Our fetchConfluenceData function is called recursively
  // until the size of the response is 0
  const fetchConfluenceDataMock = jest
    .spyOn(loader, "fetchConfluenceData")
    .mockImplementationOnce(() =>
      Promise.resolve({ size: 2, results: fakeResponse })
    )
    .mockImplementationOnce(() =>
      Promise.resolve({ size: 2, results: fakeResponse })
    )
    .mockImplementationOnce(() => Promise.resolve({ size: 0, results: [] }));

  const documents = await loader.load();

  // Validate the test results
  expect(documents.length).toBe(4);
  expect(documents[0].metadata.title).toBeDefined();
  expect(documents[0].metadata.url).toBeDefined();

  // Ensure fetchConfluenceData is called three times
  expect(fetchConfluenceDataMock).toHaveBeenCalledTimes(3);

  // Ensure the arguments are correct for each call
  expect(fetchConfluenceDataMock).toHaveBeenNthCalledWith(
    1,
    "https://example.atlassian.net/wiki/rest/api/content?spaceKey=SPACEKEY&limit=25&start=0&expand=body.storage"
  );
  expect(fetchConfluenceDataMock).toHaveBeenNthCalledWith(
    2,
    "https://example.atlassian.net/wiki/rest/api/content?spaceKey=SPACEKEY&limit=25&start=2&expand=body.storage"
  );
  expect(fetchConfluenceDataMock).toHaveBeenNthCalledWith(
    3,
    "https://example.atlassian.net/wiki/rest/api/content?spaceKey=SPACEKEY&limit=25&start=4&expand=body.storage"
  );

  // Check if the generated URLs in the metadata are correct
  expect(documents[0].metadata.url).toBe(
    "https://example.atlassian.net/wiki/spaces/SPACEKEY/pages/1"
  );
  expect(documents[1].metadata.url).toBe(
    "https://example.atlassian.net/wiki/spaces/SPACEKEY/pages/2"
  );

  // Restore the mock to its original behavior
  fetchConfluenceDataMock.mockRestore();
});
