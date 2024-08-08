import { spawn } from "node:child_process";

async function asyncSpawn(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        // eslint-disable-next-line no-process-env
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=4096",
      },
      shell: true,
    });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed: ${command} ${args.join(" ")}\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

const splitStr = `"}
{"`
const joinStr = `"},{"`

async function buildDeps() {
  const workspacesStr = (await asyncSpawn("yarn", ["workspaces", "list", "--json"])).stdout;
  const workspacesAsJsonStr = `[${workspacesStr.split(splitStr).join(joinStr)}]`
  const workspacesJson = JSON.parse(workspacesAsJsonStr);
  const filteredWorkspaces = workspacesJson.filter((ws) => ws.name.startsWith("@langchain/") || ws.name === "langchain");
}

buildDeps();