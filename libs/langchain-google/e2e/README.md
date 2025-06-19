# LangChain Google Web E2E Test

This is a test application that demonstrates the `@langchain/google/web` package bundling and functionality in a web environment.

## Features

- Basic AI chat interface using Google's Gemini model
- Streaming responses for real-time interaction
- Clean, responsive UI built with React and Vite
- Tests web bundling capabilities of the `@langchain/google/web` package

## Getting Started

### Prerequisites

1. **Google AI API Key**: You'll need a Google AI API key to use this application
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new API key
   - You can either:
     - Enter the key directly in the application interface, or
     - Set it as an environment variable (see Configuration section below)

### Installation

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Start the development server:

   ```bash
   yarn run dev
   ```

3. Open your browser and navigate to the provided local URL (usually `http://localhost:5173`)

### Configuration

You can configure the Google AI API key in two ways:

#### Option 1: Environment Variable (Recommended)

Create a `.env` file in the e2e directory:

```bash
# .env
VITE_GOOGLE_API_KEY=your-google-ai-api-key-here
```

**Note**: The `VITE_` prefix is required for Vite to make the environment variable available in the browser.

#### Option 2: Manual Entry

If no environment variable is set, you can enter your API key directly in the application interface.

### Usage

1. **Enter your API Key**: Paste your Google AI API key in the "Google AI API Key" field
2. **Enter your prompt**: Type your question or prompt in the text area
3. **Send Message**: Click the "Send Message" button to start the conversation
4. **View Response**: Watch as the AI streams its response in real-time
5. **Clear**: Use the "Clear" button to reset the conversation

### Example Prompts

Try these example prompts to test the application:

- "What is the capital of France?"
- "Explain quantum computing in simple terms"
- "Write a short poem about web development"
- "What are the benefits of streaming responses in chat applications?"

## Technical Details

### Model Configuration

The application uses the `gemini-1.5-flash` model, which is:

- Fast and efficient for real-time chat
- Supports streaming responses
- Good balance between speed and quality

### Streaming Implementation

The app demonstrates proper streaming implementation:

```typescript
const stream = await model.stream(prompt);
let fullResponse = "";

for await (const chunk of stream) {
  const content = chunk.content as string;
  fullResponse += content;
  setResponse(fullResponse);
}
```

### Web Bundling

This application tests that `@langchain/google/web` can be properly bundled for web environments using Vite, ensuring:

- Proper tree-shaking
- No Node.js-specific dependencies in the bundle
- Compatible with modern web browsers

## Build for Production

To build the application for production:

```bash
yarn run build
```

The built files will be in the `dist` directory and can be served by any static file server.

## Troubleshooting

### API Key Issues

- Ensure your API key is valid and has proper permissions
- Check that you're using the correct API key from Google AI Studio (not Google Cloud)

### Network Issues

- The application requires an internet connection to communicate with Google's API
- Check browser console for any CORS or network-related errors

### Bundle Issues

- If you encounter bundling issues, check that you're importing from `@langchain/google/web` specifically
- Ensure all dependencies are properly installed

## Development

This application serves as an E2E test for the `@langchain/google/web` package. When making changes to the core package, you can test them here by:

1. Building the core package
2. Running this E2E application
3. Verifying that streaming and bundling work correctly

## License

This is part of the LangChain.js project and follows the same license terms.
