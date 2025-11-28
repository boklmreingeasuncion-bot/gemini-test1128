export interface Coordinate {
  x: number;
  y: number;
}

export interface TileData {
  id: string; // Unique ID for React keys
  emoji: string;
  matched: boolean;
}

// The grid is a 2D array of TileData or null (empty space)
export type Grid = (TileData | null)[][];

export interface PathResult {
  connected: boolean;
  path: Coordinate[];
}

export enum GameState {
  MENU,
  PLAYING,
  WON,
  GAME_OVER
}

// Board constants removed to support dynamic difficulty levels
// Sizes are now managed in App.tsx configuration