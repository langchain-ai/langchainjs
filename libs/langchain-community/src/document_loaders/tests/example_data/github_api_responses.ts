import { GithubFile } from "../../web/github.js";

export const GithubLoaderApis = {
  getRepoFiles: {
    0: [
      {
        name: "foo.txt",
        path: "foo.txt",
        type: "file",
        size: 50,
        url: "https://githubfilecontent.com",
        html_url: "",
        sha: "",
        git_url: "",
        download_url: "",
        _links: {
          self: "",
          git: "",
          html: "",
        },
      },
      {
        name: "dir1",
        path: "dir1",
        type: "dir",
        size: 50,
        url: "https://githubfilecontent.com",
        html_url: "",
        sha: "",
        git_url: "",
        download_url: "",
        _links: {
          self: "",
          git: "",
          html: "",
        },
      },
    ],
    1: [
      {
        name: "dir1_1",
        path: "dir1/dir1_1",
        type: "dir",
        size: 50,
        url: "https://githubfilecontent.com",
        html_url: "",
        sha: "",
        git_url: "",
        download_url: "",
        _links: {
          self: "",
          git: "",
          html: "",
        },
      },
    ],
    2: [
      {
        name: "nested_file.txt",
        path: "dir1/dir1_1/nested_file.txt",
        type: "file",
        size: 50,
        url: "https://githubfilecontent.com",
        html_url: "",
        sha: "",
        git_url: "",
        download_url: "",
        _links: {
          self: "",
          git: "",
          html: "",
        },
      },
      {
        name: "EXAMPLE.md",
        path: "dir1/dir1_1/EXAMPLE.md",
        type: "file",
        size: 50,
        url: "https://githubfilecontent.com",
        html_url: "",
        sha: "",
        git_url: "",
        download_url: "",
        _links: {
          self: "",
          git: "",
          html: "",
        },
      },
    ],
  } as Record<string, GithubFile[]>,
  getFileContents: "this is a file full of stuff",
};
