import { useState, useRef } from "react";
import { ChatGoogle } from "@langchain/google/web";
import "./App.css";

// Custom ChatGoogle that uses our proxy to bypass CORS
class ChatGoogleWithProxy extends ChatGoogle {
  constructor(fields?: any) {
    super(fields);
  }

  buildConnection(fields: any, client: any) {
    super.buildConnection(fields, client);

    this.connection.buildUrlGenerativeLanguage = async () => {
      const method = await this.connection.buildUrlMethod();
      // Use our proxy endpoint instead of the direct Google API
      return `/proxy/google/v1beta/models/${this.connection.model}:${method}`;
    };

    this.streamedConnection.buildUrlGenerativeLanguage = async () => {
      const method = await this.streamedConnection.buildUrlMethod();
      // Use our proxy endpoint instead of the direct Google API
      return `/proxy/google/v1beta/models/${this.streamedConnection.model}:${method}`;
    };
  }
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(
    import.meta.env.VITE_GOOGLE_API_KEY || ""
  );
  const [error, setError] = useState("");
  const responseRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      setError("Please provide a Google AI API key");
      return;
    }

    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setError("");
    setIsLoading(true);
    setResponse("");

    try {
      const model = new ChatGoogleWithProxy({
        model: "gemini-1.5-flash",
        apiKey: apiKey,
      });

      const stream = await model.stream(prompt);
      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.content as string;
        fullResponse += content;
        setResponse(fullResponse);

        // Auto-scroll to bottom
        if (responseRef.current) {
          responseRef.current.scrollTop = responseRef.current.scrollHeight;
        }
      }
    } catch (err) {
      console.error("Error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while processing your request"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setPrompt("");
    setResponse("");
    setError("");
  };

  return (
    <div className="chat-container">
      <h1>AI Chat with Google Gemini</h1>
      <p className="description">
        Test the <code>@langchain/google/web</code> package bundling in a web
        environment
      </p>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="apiKey">Google AI API Key:</label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Google AI API key"
            className="input"
          />
          <small className="help-text">
            Get your API key from{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google AI Studio
            </a>
            {!import.meta.env.VITE_GOOGLE_API_KEY && (
              <span>
                {" "}
                or set the <code>VITE_GOOGLE_API_KEY</code> environment variable
              </span>
            )}
            {import.meta.env.VITE_GOOGLE_API_KEY && (
              <span> (using API key from environment variable)</span>
            )}
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="prompt">Prompt:</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            rows={4}
            className="textarea"
          />
        </div>

        <div className="button-group">
          <button type="submit" disabled={isLoading} className="submit-button">
            {isLoading ? "Generating..." : "Send Message"}
          </button>
          <button type="button" onClick={clearChat} className="clear-button">
            Clear
          </button>
        </div>
      </form>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {response && (
        <div className="response-section">
          <h3>Response:</h3>
          <div ref={responseRef} className="response">
            {response}
            {isLoading && <span className="cursor">|</span>}
          </div>
        </div>
      )}

      <div className="footer">
        <p>
          This application demonstrates streaming responses from Google's Gemini
          model using the <code>@langchain/google/web</code> package.
        </p>
      </div>
    </div>
  );
}

export default App;
