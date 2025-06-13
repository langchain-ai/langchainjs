import { toFile } from "openai/uploads";

import { AudioInput } from './types.js';
import { audioMimeTypeSignatures, imageMimeTypeSignatures } from './constants.js';

/**
 * Convert a base64 string to a Uint8Array.
 * 
 * @param base64String - The base64 string to convert.
 * @returns The Uint8Array.
 */
function convertBase64ToUint8Array(base64String: string) {
    const base64Url = base64String.replace(/-/g, '+').replace(/_/g, '/');
    const latin1string = atob(base64Url);
    return Uint8Array.from(latin1string, byte => byte.codePointAt(0)!);
}

/**
 * Strip ID3 tags from an MP3 file.
 * 
 * @param data - The data to strip ID3 tags from.
 * @returns The data without ID3 tags.
 */
function stripID3TagsIfPresent(data: Uint8Array | string): Uint8Array | string {
    const hasId3 =
        (typeof data === 'string' && data.startsWith('SUQz')) ||
        (typeof data !== 'string' &&
            data.length > 10 &&
            data[0] === 0x49 && // 'I'
            data[1] === 0x44 && // 'D'
            data[2] === 0x33); // '3'

    /**
     * If the data has ID3 tags, strip them.
     */
    if (hasId3) {
        const bytes =
            typeof data === 'string' ? convertBase64ToUint8Array(data) : data;
        const id3Size =
            ((bytes[6] & 0x7f) << 21) |
            ((bytes[7] & 0x7f) << 14) |
            ((bytes[8] & 0x7f) << 7) |
            (bytes[9] & 0x7f);

        // The raw MP3 starts here
        return bytes.slice(id3Size + 10);
    }

    return data;
}

/**
 * Detect the signature of an audio file.
 * 
 * @param data - The data to detect the signature of.
 * @param signatures - The signatures to detect.
 * @returns The signature of the audio file.
 */
export function detectSignature({
    data,
    signatures,
}: {
    data: Uint8Array | string;
    signatures: typeof audioMimeTypeSignatures | typeof imageMimeTypeSignatures;
}): (typeof signatures)[number] | undefined {
    const processedData = stripID3TagsIfPresent(data);

    for (const signature of signatures) {
        if (
            typeof processedData === 'string'
                ? processedData.startsWith(signature.base64Prefix)
                : processedData.length >= signature.bytesPrefix.length &&
                (signature.bytesPrefix as readonly number[]).every(
                    (byte: number, index: number) => processedData[index] === byte,
                )
        ) {
            return signature;
        }
    }

    return undefined;
}


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
    audio: AudioInput,
    filename?: string
): Promise<File> {
    const awaitedAudio = typeof audio === 'object' && 'then' in audio ? await audio : audio;

    // eslint-disable-next-line no-instanceof/no-instanceof
    if (awaitedAudio instanceof File) {
        return awaitedAudio;
    }

    const inferredFilename = await inferFilename(awaitedAudio, filename);

    // eslint-disable-next-line no-instanceof/no-instanceof
    if (awaitedAudio instanceof Buffer || awaitedAudio instanceof Uint8Array) {
        const filelike = await toFile(awaitedAudio, inferredFilename);
        return filelike as File;
    }

    // eslint-disable-next-line no-instanceof/no-instanceof
    if (awaitedAudio instanceof Blob) {
        return new File([awaitedAudio], inferredFilename, { type: awaitedAudio.type });
    }

    throw new Error("Unsupported audio type. Expected Buffer, File, or Blob.");
}