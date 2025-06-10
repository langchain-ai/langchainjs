# OpenAI Audio Transcription

This package includes support for OpenAI's Whisper API for audio transcription through the `OpenAITranscriptions` class.

## Installation

```bash
npm install @langchain/openai
```

## Setup

You'll need an OpenAI API key. Set it as an environment variable:

```bash
export OPENAI_API_KEY="your-api-key-here"
```

## Basic Usage

```typescript
import { OpenAITranscriptions } from "@langchain/openai";
import fs from "fs";

// Initialize the transcription model
const transcriber = new OpenAITranscriptions();

// Read your audio file
const audioBuffer = fs.readFileSync("path/to/your/audio.mp3");

// Transcribe the audio
const result = await transcriber.transcribe({
  audio: audioBuffer,
  filename: "audio.mp3"
});

console.log("Transcription:", result.text);
```

## Advanced Configuration

```typescript
const transcriber = new OpenAITranscriptions({
  model: "whisper-1",           // Model to use (default: "whisper-1")
  language: "en",               // Input language (improves accuracy)
  temperature: 0,               // Sampling temperature (0-1)
  response_format: "verbose_json", // Output format
  timeout: 60000,               // Request timeout in ms
});
```

## Model-Specific Response Format Support

Different OpenAI models support different response formats. The type system enforces these constraints at compile time:

### Whisper-1 Model
Supports all response formats:
- `"text"` (default): Plain text transcription
- `"json"`: JSON with just the text
- `"verbose_json"`: Detailed JSON with timestamps and metadata
- `"srt"`: SubRip subtitle format
- `"vtt"`: WebVTT subtitle format

### GPT Models (gpt-4o-mini-transcribe, gpt-4o-transcribe)
Limited to basic formats:
- `"text"` (default): Plain text transcription
- `"json"`: JSON with just the text

### Type-Safe Model Usage

```typescript
// Whisper model with all formats available
const whisperTranscriber = new OpenAITranscriptions({
  model: "whisper-1"
});

// GPT model with limited formats
const gptTranscriber = new OpenAITranscriptions<"gpt-4o-mini-transcribe">({
  model: "gpt-4o-mini-transcribe",
  response_format: "json" // Only "text" and "json" allowed
});

// This works - whisper supports verbose_json
const whisperResult = await whisperTranscriber.transcribe({
  audio: audioBuffer,
  options: {
    response_format: "verbose_json", // ✅ Valid for whisper-1
    timestamp_granularities: ["word"] // ✅ Only available for whisper-1
  }
});

// This works - GPT supports json
const gptResult = await gptTranscriber.transcribe({
  audio: audioBuffer,
  options: {
    response_format: "json" // ✅ Valid for GPT models
  }
});

// TypeScript prevents invalid combinations:
// const invalid = await gptTranscriber.transcribe({
//   options: { response_format: "srt" } // ❌ Error: "srt" not available for GPT models
// });
```

### Verbose JSON Example (with Type Safety)

```typescript
// Using generic type for type-safe verbose response
const result = await transcriber.transcribe<"verbose_json">({
  audio: audioBuffer,
  filename: "speech.wav",
  options: {
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"]
  }
});

// TypeScript knows these fields exist because we specified "verbose_json"
console.log("Text:", result.text);
console.log("Language:", result.language);
console.log("Duration:", result.duration);
console.log("Words with timestamps:", result.words);
console.log("Segments:", result.segments);
```

## Input Audio Formats

The transcriber accepts multiple input types:

```typescript
// File Buffer
const audioBuffer = fs.readFileSync("audio.mp3");
await transcriber.transcribe({ audio: audioBuffer, filename: "audio.mp3" });

// File object (browser)
const file = document.querySelector('input[type="file"]').files[0];
await transcriber.transcribe({ audio: file });

// Blob
const audioBlob = new Blob([audioData], { type: "audio/wav" });
await transcriber.transcribe({ audio: audioBlob, filename: "audio.wav" });
```

## Supported Audio Formats

Whisper supports many audio formats including:
- MP3
- MP4
- MPEG
- MPGA
- M4A
- WAV
- WEBM

## Using Context Prompts

Provide context to improve transcription accuracy:

```typescript
const result = await transcriber.transcribe({
  audio: audioBuffer,
  filename: "lecture.mp3",
  options: {
    prompt: "This is a lecture about quantum physics and machine learning.",
    language: "en",
    temperature: 0
  }
});
```

## Per-Request Options and Type Safety

You can override instance settings for individual requests and get type-safe responses:

```typescript
const transcriber = new OpenAITranscriptions({
  language: "en",
  temperature: 0
});

// Override settings for this specific transcription
const result = await transcriber.transcribe({
  audio: audioBuffer,
  filename: "spanish_audio.mp3",
  options: {
    language: "es",           // Override to Spanish
    temperature: 0.2,         // More creative transcription
    response_format: "srt"    // Get subtitle format
  }
});

// For type-safe verbose responses
const verboseResult = await transcriber.transcribe<"verbose_json">({
  audio: audioBuffer,
  filename: "detailed_audio.mp3",
  options: {
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"]
  }
});

// TypeScript knows verboseResult has additional metadata properties
console.log(`Duration: ${verboseResult.duration}s`);
console.log(`Words: ${verboseResult.words?.length}`);
```

## Error Handling

The transcriber includes automatic retry logic and proper error handling:

```typescript
try {
  const result = await transcriber.transcribe({
    audio: audioBuffer,
    filename: "audio.mp3"
  });
  console.log("Success:", result.text);
} catch (error) {
  if (error.status === 413) {
    console.error("File too large");
  } else if (error.status === 429) {
    console.error("Rate limit exceeded");
  } else {
    console.error("Transcription failed:", error.message);
  }
}
```

## LangChain Integration

The `OpenAITranscriptions` class follows LangChain patterns and includes:

- Automatic retry logic with exponential backoff
- Proper error handling and wrapping
- Serialization support
- Environment variable configuration
- Consistent API patterns with other LangChain models

## Azure OpenAI Support

For Azure OpenAI deployments, use the appropriate configuration:

```typescript
const transcriber = new OpenAITranscriptions({
  configuration: {
    baseURL: "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
    apiKey: "your-azure-api-key",
    defaultQuery: { "api-version": "2024-02-01" },
    defaultHeaders: {
      "api-key": "your-azure-api-key",
    }
  }
});
```

## Best Practices

1. **Specify language when known**: This improves accuracy and speed
2. **Use appropriate temperature**: 0 for deterministic results, higher for more creative transcription
3. **Provide context prompts**: Especially useful for technical or domain-specific content
4. **Choose the right response format**: Use `verbose_json` when you need timestamps
5. **Handle large files**: Consider chunking very large audio files
6. **Use appropriate filenames**: They help with format detection

## API Reference

### Constructor Options

- `model?: string` - Whisper model to use (default: "whisper-1")
- `language?: string` - Input language code (e.g., "en", "es", "fr")
- `prompt?: string` - Context prompt to guide transcription
- `response_format?: string` - Output format ("text" | "json" | "srt" | "vtt" | "verbose_json")
- `temperature?: number` - Sampling temperature (0-1, default: 0)
- `timestamp_granularities?: ("word" | "segment")[]` - Timestamp detail level
- `timeout?: number` - Request timeout in milliseconds
- `apiKey?: string` - OpenAI API key
- `configuration?: ClientOptions` - Additional OpenAI client options

### Methods

- `transcribe<T extends string = "text">(request: TranscriptionRequest<T>): Promise<TranscriptionResponse<T>>` - Main transcription method with type safety
- `serialize(): object` - Serialize the model configuration
- `_identifyingParams(): object` - Get model identifying parameters
- `_llmType(): string` - Returns "openai-transcriptions"

### Types

```typescript
// Generic request type based on response format
interface TranscriptionRequest<T extends string = "text"> {
  audio: Buffer | File | Blob;
  filename?: string;
  options?: Partial<OpenAITranscriptionsParams> & {
    response_format?: T;
  };
}

// Base response (for text, json, srt, vtt formats)
interface BaseTranscriptionResponse {
  text: string;
}

// Extended response with metadata (for verbose_json format)
interface VerboseTranscriptionResponse extends BaseTranscriptionResponse {
  task?: string;
  language?: string;
  duration?: number;
  words?: Array<{ word: string; start: number; end: number; }>;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
}

// Generic response type based on format
type TranscriptionResponse<T extends string = "text"> = T extends "verbose_json"
  ? VerboseTranscriptionResponse
  : BaseTranscriptionResponse;
```

#### Type Safety Examples

```typescript
// Basic transcription - only has 'text' property
const basicResult: TranscriptionResponse<"text"> = await transcriber.transcribe({
  audio: audioBuffer,
  options: { response_format: "text" }
});
console.log(basicResult.text); // ✅ Available
// console.log(basicResult.duration); // ❌ TypeScript error

// Verbose transcription - has all metadata
const verboseResult: TranscriptionResponse<"verbose_json"> = await transcriber.transcribe<"verbose_json">({
  audio: audioBuffer,
  options: { response_format: "verbose_json" }
});
console.log(verboseResult.text); // ✅ Available
console.log(verboseResult.duration); // ✅ Available
console.log(verboseResult.words); // ✅ Available
``` 