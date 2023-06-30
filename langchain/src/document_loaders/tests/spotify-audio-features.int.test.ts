// eslint-disable-next-line import/order
import { jest, test } from "@jest/globals";

import { SpotifyAudioFeaturesLoader } from "../web/spotify_audio_features.js";

test("Test SpotifyAudioFeaturesLoader", async () => {
  let originalFetch: any;
  let fetchMock: any;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should throw an error if accessToken is not provided", () => {
    expect(() => {
      // eslint-disable-next-line no-new
      new SpotifyAudioFeaturesLoader({
        accessToken: "",
        playlistId: "123",
      });
    }).toThrow("accessToken is not provided");
  });

  it("should throw an error if playlistId is not provided", () => {
    expect(() => {
      // eslint-disable-next-line no-new
      new SpotifyAudioFeaturesLoader({
        accessToken: "token",
        playlistId: "",
      });
    }).toThrow("playlistId is not provided");
  });

  it("should load audio features and return documents", async () => {
    const accessToken = "your-access-token";
    const playlistId = "your-playlist-id";
    const audioFeaturesLoader = new SpotifyAudioFeaturesLoader({
      accessToken,
      playlistId,
    });

    const playlistTracksResponse = {
      status: 200,
      json: (jest.fn() as any).mockResolvedValue({
        items: [{ track: { id: "track1" } }, { track: { id: "track2" } }],
      }),
    };
    const audioFeaturesResponse: any = {
      status: 200,
      json: (jest.fn() as any).mockResolvedValue({
        audio_features: [
          {
            id: "track1",
            danceability: 0.8,
            energy: 0.7,
            key: 2,
            loudness: -5.2,
            mode: 1,
            speechiness: 0.1,
            acousticness: 0.2,
            instrumentalness: 0.5,
            liveness: 0.3,
            valence: 0.9,
            tempo: 120,
            duration_ms: 240000,
            time_signature: 4,
          },
          {
            id: "track2",
            danceability: 0.6,
            energy: 0.5,
            key: 4,
            loudness: -6.5,
            mode: 0,
            speechiness: 0.2,
            acousticness: 0.3,
            instrumentalness: 0.8,
            liveness: 0.4,
            valence: 0.7,
            tempo: 130,
            duration_ms: 220000,
            time_signature: 4,
          },
        ],
      }),
    };

    fetchMock.mockImplementation((url: string) => {
      if (url.includes(`/playlists/${playlistId}/tracks`)) {
        return Promise.resolve(playlistTracksResponse);
      }
      if (url.includes(`/audio-features?ids=`)) {
        return Promise.resolve(audioFeaturesResponse);
      }
      return Promise.reject(new Error("Invalid URL"));
    });

    const documents = await audioFeaturesLoader.load();

    expect(documents).toEqual([
      {
        pageContent: JSON.stringify(
          audioFeaturesResponse.json().audio_features[0]
        ),
        metadata: {
          playlistId,
          trackId: "track1",
        },
      },
      {
        pageContent: JSON.stringify(
          audioFeaturesResponse.json().audio_features[1]
        ),
        metadata: {
          playlistId,
          trackId: "track2",
        },
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/playlists/${playlistId}/tracks`),
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/audio-features?ids=`),
      expect.any(Object)
    );
  });
});
