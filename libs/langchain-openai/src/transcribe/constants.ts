export const DEFAULT_RESPONSE_FORMAT = "text" as const;
export const DEFAULT_MODEL = "whisper-1" as const;
export const GPT_RESPONSE_FORMATS = ["text", "json"] as const;
export const WHISPER_RESPONSE_FORMATS = [...GPT_RESPONSE_FORMATS, "srt", "verbose_json", "vtt"] as const;
export const DEFAULT_TIMESTAMP_GRANULARITIES = ["word", "segment"] as const;

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