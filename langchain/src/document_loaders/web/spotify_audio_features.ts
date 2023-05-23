import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";

const SPOTIFY_API_URL = "https://api.spotify.com/v1";

interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  duration_ms: number;
  time_signature: number;
}

interface SpotifyAudioFeaturesParams {
  accessToken: string;
  playlistId: string;
}

export class SpotifyAudioFeaturesLoader
  extends BaseDocumentLoader
  implements SpotifyAudioFeaturesParams
{
  public accessToken: string;

  public playlistId: string;

  private headers: Record<string, string>;

  constructor({ accessToken, playlistId }: SpotifyAudioFeaturesParams) {
    super();

    if (!accessToken) {
      throw new Error("accessToken is not provided");
    }

    if (!playlistId) {
      throw new Error("playlistId is not provided");
    }

    this.accessToken = accessToken;
    this.playlistId = playlistId;

    this.headers = {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  async load(): Promise<Document[]> {
    const audioFeatures = await this.getAudioFeatures();
    const documents: Document[] = [];

    for (const item of audioFeatures) {
      documents.push({
        pageContent: JSON.stringify(item),
        metadata: {
          playlistId: this.playlistId,
          trackId: item.id,
        },
      });
    }

    return documents;
  }

  private async getPlaylistTrackIds(): Promise<string> {
    const url = `${SPOTIFY_API_URL}/playlists/${this.playlistId}/tracks?fields=items(track(id))`;

    const response = await fetch(url, { headers: this.headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Error retrieving playlist tracks: ${response.status} ${JSON.stringify(
          data
        )}`
      );
    }

    const trackIds: string[] = data.items.map((item: any) => item.track.id);

    return trackIds.join();
  }

  private async getAudioFeatures(): Promise<SpotifyAudioFeatures[]> {
    const trackIds = await this.getPlaylistTrackIds();
    const url = `${SPOTIFY_API_URL}/audio-features?ids=${trackIds}`;

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error("Error fetching audio features");
    }

    const data = await response.json();

    return data.audio_features;
  }
}
