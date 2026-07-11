export type SpotlightPlaybackPhase = "idle" | "buffering" | "playing" | "paused";

export function isSpotlightStreamVisible(phase: SpotlightPlaybackPhase): boolean {
  return phase === "playing" || phase === "paused";
}

export function isSpotlightPlaybackActive(phase: SpotlightPlaybackPhase): boolean {
  return phase !== "idle";
}
