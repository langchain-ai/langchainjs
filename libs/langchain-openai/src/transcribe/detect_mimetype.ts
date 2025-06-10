function convertBase64ToUint8Array(base64String: string) {
  const base64Url = base64String.replace(/-/g, '+').replace(/_/g, '/');
  const latin1string = atob(base64Url);
  return Uint8Array.from(latin1string, byte => byte.codePointAt(0)!);
}

export const imageMimeTypeSignatures = [
  {
    mimeType: 'image/gif' as const,
    bytesPrefix: [0x47, 0x49, 0x46],
    base64Prefix: 'R0lG',
    fileExtension: 'gif',
  },
  {
    mimeType: 'image/png' as const,
    bytesPrefix: [0x89, 0x50, 0x4e, 0x47],
    base64Prefix: 'iVBORw',
    fileExtension: 'png'
  },
  {
    mimeType: 'image/jpeg' as const,
    bytesPrefix: [0xff, 0xd8],
    base64Prefix: '/9j/',
    fileExtension: 'jpeg'
  },
  {
    mimeType: 'image/webp' as const,
    bytesPrefix: [0x52, 0x49, 0x46, 0x46],
    base64Prefix: 'UklGRg',
    fileExtension: 'webp'
  },
  {
    mimeType: 'image/bmp' as const,
    bytesPrefix: [0x42, 0x4d],
    base64Prefix: 'Qk',
    fileExtension: 'bmp'
  },
  {
    mimeType: 'image/tiff' as const,
    bytesPrefix: [0x49, 0x49, 0x2a, 0x00],
    base64Prefix: 'SUkqAA',
    fileExtension: 'tiff'
  },
  {
    mimeType: 'image/tiff' as const,
    bytesPrefix: [0x4d, 0x4d, 0x00, 0x2a],
    base64Prefix: 'TU0AKg',
    fileExtension: 'tiff'
  },
  {
    mimeType: 'image/avif' as const,
    bytesPrefix: [
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
    ],
    base64Prefix: 'AAAAIGZ0eXBhdmlm',
    fileExtension: 'avif'
  },
  {
    mimeType: 'image/heic' as const,
    bytesPrefix: [
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ],
    base64Prefix: 'AAAAIGZ0eXBoZWlj',
    fileExtension: 'heic'
  },
] as const;

export const audioMimeTypeSignatures = [
  {
    mimeType: 'audio/mpeg' as const,
    bytesPrefix: [0xff, 0xfb],
    base64Prefix: '//s=',
    fileExtension: 'mp3'
  },
  {
    mimeType: 'audio/wav' as const,
    bytesPrefix: [0x52, 0x49, 0x46, 0x46],
    base64Prefix: 'UklGR',
    fileExtension: 'wav'
  },
  {
    mimeType: 'audio/ogg' as const,
    bytesPrefix: [0x4f, 0x67, 0x67, 0x53],
    base64Prefix: 'T2dnUw',
    fileExtension: 'ogg'
  },
  {
    mimeType: 'audio/flac' as const,
    bytesPrefix: [0x66, 0x4c, 0x61, 0x43],
    base64Prefix: 'ZkxhQw',
    fileExtension: 'flac'
  },
  {
    mimeType: 'audio/aac' as const,
    bytesPrefix: [0x40, 0x15, 0x00, 0x00],
    base64Prefix: 'QBUA',
    fileExtension: 'aac'
  },
  {
    mimeType: 'audio/mp4' as const,
    bytesPrefix: [0x66, 0x74, 0x79, 0x70],
    base64Prefix: 'ZnR5cA',
    fileExtension: 'mp4'
  },
] as const;

const stripID3 = (data: Uint8Array | string) => {
  const bytes =
    typeof data === 'string' ? convertBase64ToUint8Array(data) : data;
  const id3Size =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  // The raw MP3 starts here
  return bytes.slice(id3Size + 10);
};

function stripID3TagsIfPresent(data: Uint8Array | string): Uint8Array | string {
  const hasId3 =
    (typeof data === 'string' && data.startsWith('SUQz')) ||
    (typeof data !== 'string' &&
      data.length > 10 &&
      data[0] === 0x49 && // 'I'
      data[1] === 0x44 && // 'D'
      data[2] === 0x33); // '3'

  return hasId3 ? stripID3(data) : data;
}

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
