import { glob } from "glob";
import fs from "node:fs/promises";
import axios from "axios";

const DEFAULT_WHITELIST = [
  "openai.com",
  "ibm.com",
  "x.com",
  "twitter.com",
  "npmjs.com",
];

type CheckBrokenLinksOptions = {
  logErrors?: boolean;
  timeout?: number;
  whitelist?: string[];
};

const batchArray = <T>(array: T[], batchSize: number): T[][] => {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
};

const readFile = async (
  pathName: string,
  options?: { logErrors?: boolean }
): Promise<string | null> => {
  try {
    const fileContent = await fs.readFile(pathName, "utf-8");
    return fileContent;
  } catch (e) {
    if (options?.logErrors) {
      console.error(
        {
          error: e,
        },
        `Error reading file: ${pathName}`
      );
    }
    return null;
  }
};

export const extractLinks = (content: string): string[] => {
  let links: string[] = [];
  const regex = /\[[\s\S]*?\]\((https:\/\/.*?)\)/g;
  const matches = content.match(regex);
  if (matches) {
    links = links.concat(
      matches.map((match) => {
        const [, link] = match.match(/\[[\s\S]*?\]\((https:\/\/.*?)\)/) || [];
        return link;
      })
    );
  }
  return links;
};

export const checkUrl = async (
  url: string,
  options?: CheckBrokenLinksOptions
) => {
  const timeout = options?.timeout || 3000;
  if (
    [
      ...DEFAULT_WHITELIST,
      ...(options?.whitelist ? options.whitelist : []),
    ].some((domain) => url.includes(domain))
  ) {
    return true;
  }

  try {
    const response = await axios.get(url, {
      // Allow up to 5 redirects
      maxRedirects: 5,
      // Allow status codes in the 200 and 300 range
      validateStatus: (status) => status >= 200 && status < 400,
      // Set a timeout so the request doesn't hang
      timeout,
    });

    if (response.status >= 200 && response.status < 300) {
      return true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (options?.logErrors) {
      if ("cause" in e) {
        console.error(
          {
            error: e.cause,
          },
          `Error fetching url: ${url}`
        );
      } else {
        console.error(
          {
            error: e,
          },
          `Error fetching url: ${url}`
        );
      }
    }
    return false;
  }
  return false;
};

const checkLinksInFile = async (
  filePath: string,
  options?: CheckBrokenLinksOptions
): Promise<string | number> => {
  const content = await readFile(filePath, { logErrors: options?.logErrors });
  if (!content) {
    if (options?.logErrors) {
      console.error(`Could not read file: ${filePath}`);
    }
    return 0; // Return 0 links checked for this file
  }
  const links = extractLinks(content);
  const brokenLinks = (
    await Promise.all(
      links.map(async (link) => {
        const isOk = await checkUrl(link, options);
        if (!isOk) {
          return link;
        }
        return null;
      })
    )
  ).filter((l): l is string => l !== null);
  if (brokenLinks.length) {
    return `Found ${
      brokenLinks.length
    } broken links in ${filePath}:\nLinks:\n - ${brokenLinks.join("\n - ")}`;
  }
  return links.length; // Return the number of links checked for this file
};

export async function checkBrokenLinks(
  mdxDirPath: string,
  options?: CheckBrokenLinksOptions
) {
  const startTime = Date.now();
  const allMdxFiles = await glob(`${mdxDirPath}/**/*.mdx`);
  const fileCount = allMdxFiles.length;
  let linksChecked = 0;

  const batchSize = 10;
  const batches = batchArray(allMdxFiles, batchSize);

  const results: string[] = [];

  for await (const batch of batches) {
    const batchLinksChecked = batch.map((filePath) =>
      checkLinksInFile(filePath, options)
    );

    const batchResults = await Promise.all(batchLinksChecked);
    const batchLinksCount = batchResults.reduce<number>((acc, result) => {
      if (typeof result === "number") {
        return acc + result;
      } else {
        results.push(result);
        return acc;
      }
    }, 0);

    linksChecked += batchLinksCount;
  }

  const endTime = Date.now();
  const totalTimeInSeconds = (endTime - startTime) / 1000;
  console.log(
    `Checked ${linksChecked} links inside ${fileCount} files. Took ${totalTimeInSeconds} seconds.`
  );

  if (results.length) {
    const errorMsg = results.join("\n\n");
    throw new Error(errorMsg);
  }
  console.log("No broken links found! 🎉🎉🎉");
}
