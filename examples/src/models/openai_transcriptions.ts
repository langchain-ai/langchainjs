import { OpenAITranscriptions } from "@langchain/openai";
import fs from "fs";

async function runTranscriptionExamples() {
  console.log("🎤 OpenAI Transcription Examples\n");

  // Example 1: Whisper model with all response formats
  console.log("🔹 Whisper Model (supports all formats)");
  const whisperTranscriber = new OpenAITranscriptions({
    model: "whisper-1", // Default model
    temperature: 0,
    language: "en",
  });

  // Example 2: GPT model with limited response formats
  console.log("🔹 GPT Model (supports text and json only)");
  const gptTranscriber = new OpenAITranscriptions<"gpt-4o-mini-transcribe">({
    model: "gpt-4o-mini-transcribe",
    response_format: "json", // GPT models only support "text" and "json"
  });

  // Example 3: Basic transcription from file buffer
  try {
    console.log("\n📁 Example 3: Transcribing from file buffer");
    
    // For demo purposes, we'll show the structure without actual file
    const mockAudioBuffer = Buffer.from("mock audio data");
    
    // Note: This would work with a real audio file
    /*
    const result = await whisperTranscriber.transcribe({
      audio: audioBuffer,
      filename: "audio.mp3",
    });
    
    console.log("Transcription:", result.text);
    */
    
    console.log("✅ Structure ready for real audio file\n");
  } catch (error) {
    console.error("❌ Error in basic transcription:", error);
  }

  // Example 4: Model-specific response formats
  try {
    console.log("🎯 Example 4: Model-specific response formats");
    
    // Whisper supports all formats including verbose_json
    /*
    const whisperVerbose = await whisperTranscriber.transcribe({
      audio: audioBuffer,
      filename: "audio.mp3",
      options: {
        response_format: "verbose_json", // ✅ Available for whisper-1
        timestamp_granularities: ["word", "segment"], // ✅ Available for whisper-1
      },
    });
    
    const whisperSrt = await whisperTranscriber.transcribe({
      audio: audioBuffer,
      filename: "audio.mp3", 
      options: {
        response_format: "srt", // ✅ Available for whisper-1
      },
    });
    
    // GPT models only support text and json
    const gptJson = await gptTranscriber.transcribe({
      audio: audioBuffer,
      filename: "audio.mp3",
      options: {
        response_format: "json", // ✅ Available for GPT models
      },
    });
    
    // TypeScript prevents invalid combinations:
    // const gptSrt = await gptTranscriber.transcribe({
    //   options: { response_format: "srt" } // ❌ Error: "srt" not available for GPT models
    // });
    */
    
    console.log("✅ Type-safe model-specific format support\n");
  } catch (error) {
    console.error("❌ Error with model-specific formats:", error);
  }

  // Example 5: Transcription with verbose output (type-safe)
  try {
    console.log("📊 Example 5: Verbose transcription with timestamps");
    
    const mockAudioBlob = new Blob(["mock audio"], { type: "audio/wav" });
    
    // This would provide detailed output with word-level timestamps
    // Note: The generic type ensures type safety for the response
    /*
    const verboseResult = await whisperTranscriber.transcribe<"verbose_json">({
      audio: mockAudioBlob,
      filename: "speech.wav",
      options: {
        response_format: "verbose_json",
        timestamp_granularities: ["word", "segment"],
        temperature: 0.1,
      },
    });
    
    // TypeScript knows these fields exist because we specified "verbose_json"
    console.log("Full transcription:", verboseResult.text);
    console.log("Language detected:", verboseResult.language);
    console.log("Duration:", verboseResult.duration);
    console.log("Word timestamps:", verboseResult.words);
    console.log("Segments:", verboseResult.segments);
    */
    
    console.log("✅ Verbose format configured with type safety\n");
  } catch (error) {
    console.error("❌ Error in verbose transcription:", error);
  }

  // Example 6: Different response formats
  try {
    console.log("📄 Example 6: Different output formats");
    
    // SRT subtitle format
    /*
    const srtResult = await whisperTranscriber.transcribe({
      audio: mockAudioBuffer,
      filename: "video.mp4",
      options: {
        response_format: "srt",
      },
    });
    console.log("SRT subtitles:", srtResult.text);
    */

    // VTT subtitle format
    /*
    const vttResult = await whisperTranscriber.transcribe({
      audio: mockAudioBuffer, 
      filename: "video.mp4",
      options: {
        response_format: "vtt",
      },
    });
    console.log("VTT subtitles:", vttResult.text);
    */
    
    console.log("✅ Multiple formats supported (text, json, srt, vtt, verbose_json)\n");
  } catch (error) {
    console.error("❌ Error with different formats:", error);
  }

  // Example 7: Using prompt for context
  try {
    console.log("💡 Example 7: Using prompt for better accuracy");
    
    /*
    const contextualResult = await whisperTranscriber.transcribe({
      audio: mockAudioBuffer,
      filename: "technical_talk.mp3",
      options: {
        prompt: "This is a technical presentation about machine learning and artificial intelligence.",
        language: "en",
        temperature: 0,
      },
    });
    
    console.log("Contextual transcription:", contextualResult.text);
    */
    
    console.log("✅ Prompt can provide context for better accuracy\n");
  } catch (error) {
    console.error("❌ Error in contextual transcription:", error);
  }

  console.log("🎯 Key Features:");
  console.log("• Supports multiple audio formats (mp3, wav, m4a, etc.)");
  console.log("• Multiple output formats (text, json, srt, vtt, verbose_json)");
  console.log("• Language specification for better accuracy");
  console.log("• Temperature control for deterministic vs creative output");
  console.log("• Prompt context for domain-specific transcription");
  console.log("• Word and segment-level timestamps (with verbose_json)");
  console.log("• Full LangChain integration with async calling and error handling");
}

// Example of actual usage with environment variables and type safety
export async function transcribeAudioFile(audioFilePath: string) {
  // Make sure to set your OpenAI API key in environment variables
  // export OPENAI_API_KEY="your-api-key-here"
  
  const transcriber = new OpenAITranscriptions();
  
  try {
    const audioBuffer = fs.readFileSync(audioFilePath);
    
    // Using verbose response format
    const result = await transcriber.transcribe({
      audio: audioBuffer,
      filename: audioFilePath,
      options: {
        language: "en", // Optional: specify language
        response_format: "verbose_json", // Get detailed output
        temperature: 0, // More deterministic
        timestamp_granularities: ["word", "segment"], // Get word-level timestamps
      },
    });
    
    // TypeScript knows these properties exist
    console.log(`Transcribed ${result.duration} seconds of audio in ${result.language}`);
    console.log(`Found ${result.words?.length} words`);
    
    return result;
  } catch (error) {
    console.error("Transcription failed:", error);
    throw error;
  }
}

// Example for basic text transcription
export async function transcribeAudioFileBasic(audioFilePath: string) {
  const transcriber = new OpenAITranscriptions();
  
  try {
    const audioBuffer = fs.readFileSync(audioFilePath);
    
    // Using default generic type (text format)
    const result = await transcriber.transcribe({
      audio: audioBuffer,
      filename: audioFilePath,
      options: {
        language: "en",
        temperature: 0,
      },
    });
    
    // TypeScript knows only 'text' property exists
    return result.text;
  } catch (error) {
    console.error("Transcription failed:", error);
    throw error;
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runTranscriptionExamples().catch(console.error);
} 