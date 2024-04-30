import { parse, format } from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";

export async function moveAndRename({
  source,
  dest,
  abs,
}: {
  source: string;
  dest: string;
  abs: (p: string) => string;
}) {
  // const tmpPackageJsonPath = abs(join("src", "package.json"));
  try {
    // For TypeScript v5.4.5
    // await writeFile(tmpPackageJsonPath, JSON.stringify({}));

    for (const file of await readdir(abs(source), { withFileTypes: true })) {
      if (file.isDirectory()) {
        await moveAndRename({
          source: `${source}/${file.name}`,
          dest: `${dest}/${file.name}`,
          abs,
        });
      } else if (file.isFile()) {
        const parsed = parse(file.name);

        // Ignore anything that's not a .js file
        if (parsed.ext !== ".js") {
          continue;
        }

        // Rewrite any require statements to use .cjs
        const content = await readFile(abs(`${source}/${file.name}`), "utf8");
        const rewritten = content.replace(
          /require\("(\..+?).js"\)/g,
          (_, p1) => `require("${p1}.cjs")`
        );

        // Rename the file to .cjs
        const renamed = format({ name: parsed.name, ext: ".cjs" });

        await writeFile(abs(`${dest}/${renamed}`), rewritten, "utf8");
      }
    }
  } catch (err) {
    console.error(err);
    // cleanup
    // await unlink(tmpPackageJsonPath);
    process.exit(1);
  }
}
