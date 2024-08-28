import fs from "fs";

const [pathname] = process.argv.slice(2);

if (!pathname) {
  throw new Error("No pathname provided.");
}

/**
 * tslab will sometimes throw an error inside the output cells of a notebook
 * if the notebook is being rebuilt. This function checks for that error,
 * because we do not want to commit that to our docs.
 */
export async function checkUnexpectedRebuildError() {
  if (!pathname.endsWith(".ipynb")) {
    throw new Error("Only .ipynb files are supported.");
  }
  const notebookContents = await fs.promises.readFile(pathname, "utf-8");
  if (
    notebookContents.includes(
      "UncaughtException: Error: Unexpected pending rebuildTimer"
    )
  ) {
    throw new Error(`Found unexpected pending rebuildTimer in ${pathname}`);
  }
}
