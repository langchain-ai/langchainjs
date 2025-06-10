import { toFile } from "openai/uploads";

import { detectSignature, audioMimeTypeSignatures } from './detect_mimetype.js'

/**
 * Infer the filename from the audio data. If a filename is provided, it will be used.
 * If not, the filename will be inferred from the audio data.
 * 
 * @param audio - The audio data.
 * @param filename - The filename to use provided by the user.
 * @returns The inferred filename.
 */
async function inferFilename(audio: Buffer | File | Uint8Array | Blob, filename?: string): Promise<string> {
    if (filename) {
        return filename;
    }

    // eslint-disable-next-line no-instanceof/no-instanceof
    const data = audio instanceof Blob ? new Uint8Array(await audio.arrayBuffer()) : audio;
    const fileSignature = detectSignature({
        data,
        signatures: audioMimeTypeSignatures,
    })
    if (!fileSignature) {
        throw new Error(`Can't determine file extension from audio data, please provide a "filename" parameter.`);
    }

    return `audio.${fileSignature.fileExtension}`;
}

/**
 * Prepare audio file for the API call.
 * If the audio is already a File, it will be returned as is.
 * If the audio is a Buffer or Uint8Array, it will be converted to a File.
 * If the audio is a Blob, it will be converted to a File.
 * If the audio is not a Buffer, File, or Blob, an error will be thrown.
 * 
 * @param audio - The audio data.
 * @param filename - The filename to use provided by the user.
 * @returns The prepared audio file.
 */
export async function prepareAudioFile(
    audio: Buffer | File | Uint8Array | Blob,
    filename?: string
): Promise<File> {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (audio instanceof File) {
        return audio;
    }

    const inferredFilename = await inferFilename(audio, filename);

    // eslint-disable-next-line no-instanceof/no-instanceof
    if (audio instanceof Buffer || audio instanceof Uint8Array) {
        const filelike = await toFile(audio, inferredFilename);
        return filelike as File;
    }

    // eslint-disable-next-line no-instanceof/no-instanceof
    if (audio instanceof Blob) {
        return new File([audio], inferredFilename, { type: audio.type });
    }

    throw new Error("Unsupported audio type. Expected Buffer, File, or Blob.");
}