import path from "node:path";
import fs from "node:fs";

export async function moveAndRename({
  source,
  dest,
  abs,
}: {
  source: string;
  dest: string;
  abs: (p: string) => string;
}) {
  try {
    for (const file of await fs.promises.readdir(abs(source), {
      withFileTypes: true,
    })) {
      if (file.isDirectory()) {
        await moveAndRename({
          source: `${source}/${file.name}`,
          dest: `${dest}/${file.name}`,
          abs,
        });
      } else if (file.isFile()) {
        const parsed = path.parse(file.name);

        // Ignore anything that's not a .js file
        if (parsed.ext !== ".js") {
          continue;
        }

        // Rewrite any require statements to use .cjs
        const content = await fs.promises.readFile(
          abs(`${source}/${file.name}`),
          "utf8"
        );
        const rewritten = content.replace(
          /require\("(\..+?).js"\)/g,
          (_, p1) => `require("${p1}.cjs")`
        );

        // Rename the file to .cjs
        const renamed = path.format({ name: parsed.name, ext: ".cjs" });

        await fs.promises.writeFile(
          abs(`${dest}/${renamed}`),
          rewritten,
          "utf8"
        );
      }
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
