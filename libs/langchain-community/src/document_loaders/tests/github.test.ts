import { jest, test } from "@jest/globals";
import { GithubFile, GithubRepoLoader } from "../web/github.js";
import { GithubLoaderApis } from "./example_data/github_api_responses.js";

describe("GithubRepoLoader recursion", () => {
  let callCount = 0;
  beforeAll(() => {
    global.fetch = jest.fn().mockImplementation((url) => {
      let responseData: GithubFile[] | string =
        GithubLoaderApis.getRepoFiles[callCount.toString()];

      if ((url as string).includes("https://api.github.com/repos")) {
        responseData = GithubLoaderApis.getRepoFiles[callCount.toString()];
        callCount += 1;
      } else if ((url as string).includes("githubfilecontent.com")) {
        responseData = GithubLoaderApis.getFileContents;
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(responseData),
        text: () => Promise.resolve("this is a file full of stuff"),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  });

  afterAll(() => {
    jest.clearAllMocks();
    callCount = 0;
  });

  test("Test recursion with GithubRepoLoader", async () => {
    const loader = new GithubRepoLoader(
      "https://github.com/langchain-ai/langchainjs",
      {
        branch: "main",
        recursive: true,
        unknown: "warn",
        ignorePaths: ["*.md"],
      }
    );

    const documents = await loader.load();
    expect(documents.length).toBe(2);
    expect(documents.map((doc) => doc.metadata.source)).toEqual([
      "foo.txt",
      "dir1/dir1_1/nested_file.txt",
    ]);
  });

  test("Expect an error if processSubmodules set without recursive with GithubRepoLoader", async () => {
    expect(
      () =>
        new GithubRepoLoader("https://github.com/langchain-ai/langchainjs", {
          branch: "main",
          recursive: false,
          processSubmodules: true,
          unknown: "warn",
          ignorePaths: ["*.md"],
        })
    ).toThrow();
  });
});

describe("GithubRepoLoader URL encoding", () => {
  test("Should properly encode special characters in directory paths", async () => {
    // Mock fetch to capture the URLs being called
    const mockFetch = jest.fn().mockImplementation((url) => {
      // Check that special characters are properly encoded in the URL
      expect(url).toContain("src%2Fapp%2F%255Fmeta"); // The full encoded path

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              name: "%5Fmeta",
              path: "src/app/%5Fmeta",
              type: "dir",
              size: 0,
              url: "https://api.github.com/repos/test/test/contents/src/app/%5Fmeta",
              html_url: "",
              sha: "abc123",
              git_url: "",
              download_url: "",
              _links: {
                self: "",
                git: "",
                html: "",
              },
            },
          ]),
      });
    });

    global.fetch = mockFetch as any;

    const loader = new GithubRepoLoader(
      "https://github.com/test/test/tree/main/src/app/%5Fmeta",
      {
        branch: "main",
        recursive: false,
        unknown: "warn",
      }
    );

    // This should call fetchRepoFiles with "src/app/%5Fmeta" path
    await loader.load();

    // Verify that fetch was called with properly encoded URL
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("contents/src%2Fapp%2F%255Fmeta"),
      expect.any(Object)
    );
  });
});
