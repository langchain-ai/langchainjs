import { glob } from "glob";
import fs from "node:fs/promises";

export const readFile = async (
  path: string, options?: { logErrors?: boolean }
): Promise<string | null> => {
  try {
    const fileContent = await fs.readFile(path, "utf-8");
    return fileContent;
  } catch (e) {
    if (options?.logErrors) {
      console.error(e);
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

export const fetchUrl = async (
  url: string, options?: { logErrors?: boolean }
): Promise<boolean> => {
  try {
    const timeout = (ms: number) =>
      new Promise((_, reject) =>
        // eslint-disable-next-line no-promise-executor-return
        setTimeout(() => reject(new Error("timeout")), ms)
      );
    const response = await Promise.race([fetch(url), timeout(3000)]);
    return (response as { ok: boolean }).ok;
  } catch (e) {
    if (options?.logErrors) {
      console.error(
        {
          error: e,
        },
        `Error fetching url: ${url}`
      );
    }
  }
  return false;
};

export async function checkBrokenLinks(mdxDirPath: string, options?: { logErrors?: boolean }) {
  const allMdxFiles = await glob(`${mdxDirPath}/**/*.mdx`);

  // Batch into 10 files at a time
  const batchSize = 10;
  const batches = [];
  for (let i = 0; i < allMdxFiles.length; i += batchSize) {
    batches.push(allMdxFiles.slice(i, i + batchSize));
  }

  let results: string[] = [];

  for await (const batch of batches) {
    const result = (await Promise.all(batch.map(async (filePath) => {
      const content = await readFile(filePath);
      if (!content) {
        if (options?.logErrors) {
          console.error(`Could not read file: ${filePath}`);
        }
        return;
      }
      const links = extractLinks(content);
      if (links.length) {
        const brokenLinks = (await Promise.all(links.map(async (link) => {
          const isOk = await fetchUrl(link);
          if (!isOk) {
            return link;
          }
          return null;
        }))).filter((l): l is string => l !== null);
        if (brokenLinks.length) {
          return `Found ${brokenLinks.length} broken links in ${filePath}:\nLinks:\n - ${brokenLinks.join("\n - ")}`
        }
      }
      return null;
    }))).filter((l): l is string => l !== null);
    results = results.concat(result);
  }

  if (results.length) {
    console.error(results.join("\n"));
    process.exit(1);
  }
  console.log("No broken links found!");
  process.exit(0);
}
