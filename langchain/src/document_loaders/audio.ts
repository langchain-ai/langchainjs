import type { readFile as ReadFileT } from "fs/promises";
import { Audio } from "../audio.js";
import { getEnv } from "../util/env.js";
import { BaseAudioLoader } from "./base.js";

export class AudioLoader extends BaseAudioLoader {
  constructor(public filePath: string) {
    super();
  }

  public async load(): Promise<Audio[]> {
    const { readFile } = await AudioLoader.imports();
    const buffer = await readFile(this.filePath);
    const file = new Blob([buffer]);
    const metadata = { source: this.filePath };
    return [new Audio({ file, metadata })];
  }

  static async imports(): Promise<{
    readFile: typeof ReadFileT;
  }> {
    try {
      const { readFile } = await import("fs/promises");
      return { readFile };
    } catch (e) {
      console.error(e);
      throw new Error(
        `Failed to load fs/promises. AudioLoader available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`
      );
    }
  }
}
