import fs from "node:fs/promises";
import path from "node:path";

import { describe, it, expect } from "vitest";
import { prepareAudioFile, detectSignature } from "./utils.js";
import { audioMimeTypeSignatures } from "./constants.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

describe("prepareAudioFile", () => {
  it("should prepare an audio file", async () => {
    const audio = await prepareAudioFile(new File([], "test.mp3"));
    expect(audio).toBeInstanceOf(File);
  });

  it("should prepare an audio file with a filename", async () => {
    const audio = await prepareAudioFile(new File([], "test.mp3"), "test.mp3");
    expect(audio).toBeInstanceOf(File);
  });

  it("should prepare an audio file with a promise", async () => {
    const audio = await prepareAudioFile(Promise.resolve(new File([], "test.mp3")));
    expect(audio).toBeInstanceOf(File);
  });

  it("should prepare a real audio file", async () => {
    const audio = await prepareAudioFile(fs.readFile(`${__dirname}/__fixtures__/galileo.mp3`));
    expect(audio.name).toBe("audio.mp3");
  });
});

describe('detectSignature', () => {
    const formatTestCases = [
        {
          name: "MP3",
          signature: [0xff, 0xfb, 0x00, 0x00],
          expectedExtension: "mp3",
        },
        {
          name: "WAV",
          signature: [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00],
          expectedExtension: "wav",
        },
        {
          name: "FLAC",
          signature: [0x66, 0x4c, 0x61, 0x43],
          expectedExtension: "flac",
        },
        {
          name: "OGG",
          signature: [0x4f, 0x67, 0x67, 0x53],
          expectedExtension: "ogg",
        },
    ];

    formatTestCases.forEach(({ name, signature, expectedExtension }) => {
        it(`should detect ${name} format from signature and use correct extension`, async () => {
            const audio = await detectSignature({
                data: new Uint8Array(signature),
                signatures: audioMimeTypeSignatures,
            });
            expect(audio?.fileExtension).toBe(expectedExtension);
        });
    });
});