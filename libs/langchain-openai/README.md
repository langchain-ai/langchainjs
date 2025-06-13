# @langchain/openai

This package contains the LangChain.js integrations for OpenAI through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/openai @langchain/core
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate fields to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.0.0"
  },
  "resolutions": {
    "@langchain/core": "^0.3.0"
  },
  "overrides": {
    "@langchain/core": "^0.3.0"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "^0.3.0"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `yarn`, `npm`, and `pnpm` to maximize compatibility.

## Chat Models

This package contains the `ChatOpenAI` class, which is the recommended way to interface with the OpenAI series of models.

To use, install the requirements, and configure your environment.

```bash
export OPENAI_API_KEY=your-api-key
```

Then initialize

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4-1106-preview",
});
const response = await model.invoke(new HumanMessage("Hello world!"));
```

### Streaming

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4-1106-preview",
});
const response = await model.stream(new HumanMessage("Hello world!"));
```

## Embeddings

This package also adds support for OpenAI's embeddings model.

```typescript
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
});
const res = await embeddings.embedQuery("Hello world");
```

## Transcription

This package includes support for OpenAI's Whisper API for audio transcription through the `OpenAITranscriptions` class.

### Basic Usage

```typescript
import { OpenAITranscriptions } from "@langchain/openai";
import fs from "fs";

// Initialize the transcription model
const transcriber = new OpenAITranscriptions({
  apiKey: process.env.OPENAI_API_KEY,
});

// Read your audio file
const audioBuffer = fs.readFileSync("path/to/your/audio.mp3");

// Transcribe the audio
const result = await transcriber.transcribe({
  audio: audioBuffer,
  filename: "audio.mp3"
});

console.log("Transcription:", result.text);
```

### Advanced Configuration

```typescript
const transcriber = new OpenAITranscriptions({
  model: "whisper-1",           // Model to use (default: "whisper-1")
  language: "en",               // Input language (improves accuracy)
  temperature: 0,               // Sampling temperature (0-1)
  response_format: "verbose_json", // Output format
  timeout: 60000,               // Request timeout in ms
});
```

### Supported Response Formats

The transcriber supports multiple response formats:

- `"text"` (default): Plain text transcription
- `"json"`: JSON with just the text
- `"verbose_json"`: Detailed JSON with timestamps and metadata
- `"srt"`: SubRip subtitle format
- `"vtt"`: WebVTT subtitle format

### Supported Audio Formats

The transcriber supports various audio formats including:
- MP3
- MP4
- MPEG
- MPGA
- M4A
- WAV
- WEBM

### Using Context Prompts

You can provide context to improve transcription accuracy:

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

### Type-Safe Usage

The transcriber includes TypeScript support for type-safe responses:

```typescript
// Basic transcription - only has 'text' property
const basicResult = await transcriber.transcribe({
  audio: audioBuffer,
  options: { response_format: "text" }
});
console.log(basicResult.text); // ✅ Available

// Verbose transcription - has all metadata
const verboseResult = await transcriber.transcribe<"verbose_json">({
  audio: audioBuffer,
  filename: "detailed_audio.mp3",
  options: {
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"]
  }
});

// TypeScript knows these fields exist
console.log("Text:", verboseResult.text);
console.log("Language:", verboseResult.language);
console.log("Duration:", verboseResult.duration);
console.log("Words with timestamps:", verboseResult.words);
console.log("Segments:", verboseResult.segments);
```

### Error Handling

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

## Development

To develop the OpenAI package, you'll need to follow these instructions:

### Install dependencies

```bash
yarn install
```

### Build the package

```bash
yarn build
```

Or from the repo root:

```bash
yarn build --filter=@langchain/openai
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
$ yarn test
$ yarn test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
yarn lint && yarn format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `entrypoints` field in the `config` variable located inside `langchain.config.js` and run `yarn build` to generate the new entrypoint.
