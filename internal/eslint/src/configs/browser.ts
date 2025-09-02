import type { ConfigArray } from "typescript-eslint";

// Browser specific ESLint configuration
const config: ConfigArray = [
  {
    name: "browser/base",
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        location: "readonly",
        history: "readonly",
        CustomEvent: "readonly",
        Event: "readonly",
        EventTarget: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        DOMParser: "readonly",
        XMLSerializer: "readonly",
        WebSocket: "readonly",
        Worker: "readonly",
        SharedWorker: "readonly",
        crypto: "readonly",
        Crypto: "readonly",
        CryptoKey: "readonly",
        SubtleCrypto: "readonly",
      },
    },
    rules: {
      // Browser specific rules
      "no-restricted-globals": [
        "error",
        {
          name: "window",
          message: "Use globalThis instead of window for better compatibility.",
        },
      ],
    },
  },
];

export default config;
