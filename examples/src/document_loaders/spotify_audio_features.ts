import { SpotifyAudioFeaturesLoader } from "langchain/document_loaders/web/spotify_audio_features";

const loader = new SpotifyAudioFeaturesLoader({
  accessToken: "accessToken", // Or read it from process.env.SPOTIFY_ACCESS_TOKEN
  playlistId: "playlistId",
});

const docs = await loader.load();
console.log({ docs });
