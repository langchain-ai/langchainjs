import * as fs from "node:fs/promises";
import * as ts from "typescript";
import { v4 as uuidv4 } from "uuid";

export async function extract(filepath: string) {
  const cells = JSON.parse((await fs.readFile(filepath)).toString()).cells;
  const code = cells
    .map((cell: Record<string, any>) => {
      if (cell.cell_type === "code") {
        return cell.source.join("");
      }
      return "";
    })
    .join("\n");
  return code;
}

let [pathname, ...args] = process.argv.slice(2);

if (!pathname) {
  throw new Error("No pathname provided.");
}

const run = async () => {
  if (pathname.startsWith("docs/core_docs/")) {
    pathname = "./" + pathname.slice("docs/core_docs/".length);
  }
  if (!pathname.endsWith(".ipynb")) {
    throw new Error("Only .ipynb files are supported.");
  }
  const filename = pathname
    .split("/")
    [pathname.split("/").length - 1].replace(".ipynb", ".mts");
  const tempFilepath = `./tmp/${filename}`;
  try {
    const typescriptSource = await extract(pathname);
    try {
      await fs.access("./tmp", fs.constants.F_OK);
    } catch (err) {
      await fs.mkdir("./tmp");
    }
    await fs.writeFile(tempFilepath, typescriptSource);
    const program = ts.createProgram([tempFilepath], {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2021,
      alwaysStrict: true,
      skipLibCheck: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length === 0) {
      console.log("No type errors found.");
    } else {
      diagnostics.forEach((diagnostic) => {
        if (diagnostic.file) {
          const { line, character } =
            diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
          const message = ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            "\n"
          );
          console.log(
            `${diagnostic.file.fileName} (${line + 1},${
              character + 1
            }): ${message}`
          );
        } else {
          console.log(
            ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
          );
        }
      });
    }
  } finally {
    try {
      await fs.rm(tempFilepath);
    } catch (e) {
      // Do nothing
    }
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
