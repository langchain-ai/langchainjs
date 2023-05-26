import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";

const SPOTIFY_API_URL = "https://api.spotify.com/v1";

interface SpotifyAudioFeatures {
  /**
   * The Spotify ID for the track. Example value: "2takcwOaAZWiXQijPHIx7B"
   */
  id: string;

  /**
   * The object type. Allowed values: "audio_features"
   */
  type: string;

  /**
   * The Spotify URI for the track. Example value:
   * "spotify:track:2takcwOaAZWiXQijPHIx7B"
   */
  uri: string;

  /**
   * Danceability describes how suitable a track is for dancing based on a
   * combination of musical elements including tempo, rhythm stability, beat
   * strength, and overall regularity. A value of 0.0 is least danceable and 1.0
   * is most danceable. Example value: 0.585
   */
  danceability: number;

  /**
   * Energy is a measure from 0.0 to 1.0 and represents a perceptual measure of
   * intensity and activity. Typically, energetic tracks feel fast, loud, and
   * noisy. For example, death metal has high energy, while a Bach prelude
   * scores low on the scale. Perceptual features contributing to this attribute
   * include dynamic range, perceived loudness, timbre, onset rate, and general
   * entropy. Example value: 0.842
   */
  energy: number;

  /**
   * The key the track is in. Integers map to pitches using standard Pitch Class
   * notation. E.g. 0 = C, 1 = C♯/D♭, 2 = D, and so on. If no key was detected,
   * the value is -1. Example value: 9 Range: -1 - 11
   */
  key: number;

  /**
   * The overall loudness of a track in decibels (dB). Loudness values are
   * averaged across the entire track and are useful for comparing relative
   * loudness of tracks. Loudness is the quality of a sound that is the primary
   * psychological correlate of physical strength (amplitude). Values typically
   * range between -60 and 0 db. Example value: -5.883
   */
  loudness: number;

  /**
   * Mode indicates the modality (major or minor) of a track, the type of scale
   * from which its melodic content is derived. Major is represented by 1 and
   * minor is 0. Example value: 0
   */
  mode: number;

  /**
   * Speechiness detects the presence of spoken words in a track. The more
   * exclusively speech-like the recording (e.g. talk show, audio book, poetry),
   * the closer to 1.0 the attribute value. Values above 0.66 describe tracks
   * that are probably made entirely of spoken words. Values between 0.33 and
   * 0.66 describe tracks that may contain both music and speech, either in
   * sections or layered, including such cases as rap music. Values below 0.33
   * most likely represent music and other non-speech-like tracks. Example
   * value: 0.0556
   */
  speechiness: number;
  /**
   * A confidence measure from 0.0 to 1.0 of whether the track is acoustic. 1.0
   * represents high confidence the track is acoustic. Example value: 0.00242
   * Range: 0 - 1
   */
  acousticness: number;

  /**
   * A URL to access the full audio analysis of this track. An access token is
   * required to access this data. Example value:
   * "https://api.spotify.com/v1/audio-analysis/2takcwOaAZWiXQijPHIx7B"
   */
  analysis_url: string;

  /**
   * Predicts whether a track contains no vocals. "Ooh" and "aah" sounds are
   * treated as instrumental in this context. Rap or spoken word tracks are
   * clearly "vocal". The closer the instrumentalness value is to 1.0, the
   * greater likelihood the track contains no vocal content. Values above 0.5
   * are intended to represent instrumental tracks, but confidence is higher as
   * the value approaches 1.0. Example value: 0.00686
   */
  instrumentalness: number;

  /**
   * Detects the presence of an audience in the recording. Higher liveness
   * values represent an increased probability that the track was performed
   * live. A value above 0.8 provides strong likelihood that the track is live.
   * Example value: 0.0866
   */
  liveness: number;

  /**
   * A measure from 0.0 to 1.0 describing the musical positiveness conveyed by a
   * track. Tracks with high valence sound more positive (e.g. happy, cheerful,
   * euphoric), while tracks with low valence sound more negative (e.g. sad,
   * depressed, angry). Example value: 0.428 Range: 0 - 1
   */
  valence: number;

  /**
   * The overall estimated tempo of a track in beats per minute (BPM). In
   * musical terminology, tempo is the speed or pace of a given piece and
   * derives directly from the average beat duration. Example value: 118.211
   */
  tempo: number;
  /**
   * The duration of the track in milliseconds. Example value: 237040
   */
  duration_ms: number;

  /**
   * An estimated time signature. The time signature (meter) is a notational
   * convention to specify how many beats are in each bar (or measure). The time
   * signature ranges from 3 to 7 indicating time signatures of "3/4", to "7/4".
   * Example value: 4 Range: 3 - 7
   */
  time_signature: number;

  /**
   * A link to the Web API endpoint providing full details of the track. Example
   * value: "https://api.spotify.com/v1/tracks/2takcwOaAZWiXQijPHIx7B"
   */
  track_href: string;
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

    const token =
      accessToken ?? typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.SPOTIFY_ACCESS_TOKEN
        : undefined;

    if (!token) {
      throw new Error("You must provide the SPOTIFY_ACCESS_TOKEN");
    }

    if (!playlistId) {
      throw new Error("playlistId is not provided");
    }

    this.accessToken = token;
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
