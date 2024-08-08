const { spawn } = require("node:child_process");

/**
 *
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<string>}
 */
async function asyncSpawn(command, args) {
  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(command, args, {
      stdio: ["inherit", "pipe", "pipe"],
      env: {
        // eslint-disable-next-line no-process-env
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=4096",
      },
      shell: true,
    });

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`Command failed: ${command} ${args.join(" ")}\n${output}`)
        );
        return;
      }
      resolve(output);
    });
  });
}

const strToSplit = `"},
]`;

async function main() {
  const allWorkspacesString =
    `[${(await asyncSpawn("yarn", ["workspaces", "list", "--json"]))
      .split(`"}`)
      .join(`"},`)}]`.split(strToSplit)[0] + `"}]`;
  const allWorkspacesJson = JSON.parse(allWorkspacesString);
  const workspacesToBuild = allWorkspacesJson.filter(
    (ws) => ws.name.startsWith("@langchain/") || ws.name === "langchain"
  );
  for await (const ws of workspacesToBuild) {
    await asyncSpawn("yarn", ["workspace", ws.name, "build"]);
    console.log("Built", ws.name);
  }
}

main();
