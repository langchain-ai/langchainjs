---
"@langchain/aws": minor
---

feat(aws): Add video and audio content block support for ChatBedrockConverse input messages

- Convert standard multimodal video/audio blocks (base64, Uint8Array, data URL, S3 URI) to Bedrock's native format
- Pass through native Bedrock video/audio blocks unchanged
- Adds support for all Bedrock video formats (flv, mkv, mov, mp4, mpeg, mpg, three_gp, webm, wmv) and audio formats (aac, flac, m4a, mka, mkv, mp3, mp4, mpeg, mpga, ogg, opus, pcm, wav, webm, x-aac)
