/**
 * Music / soundscape boundary for STRIDE Focus.
 *
 * Provider-agnostic interface.
 * In this phase, no music provider is connected, so the state is truthfully "unavailable".
 * The UI must render this state honestly and never fake playback.
 */

export type MusicState = "unavailable" | "ready" | "playing" | "paused";

export type SoundscapeTrack = {
  id: string;
  title: string;
  artist?: string;
};

export interface MusicClient {
  getState(): Promise<MusicState>;
  play(): Promise<void>;
  pause(): Promise<void>;
  getCurrentTrack(): Promise<SoundscapeTrack | null>;
}

export class StrideMusicClient implements MusicClient {
  async getState(): Promise<MusicState> {
    // Truthfully report unavailable until a music provider (e.g. Spotify, Apple Music, or native soundscape) is configured
    return "unavailable";
  }

  async play(): Promise<void> {
    // No-op: no provider wired up
  }

  async pause(): Promise<void> {
    // No-op: no provider wired up
  }

  async getCurrentTrack(): Promise<SoundscapeTrack | null> {
    return null;
  }
}

export const musicClient = new StrideMusicClient();
