import { Coordinate, Grid } from '../types';

/**
 * Checks if a specific cell is empty (walkable).
 */
const isEmpty = (grid: Grid, { x, y }: Coordinate): boolean => {
  // Safety check for bounds
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return false;
  return grid[y][x] === null;
};

const isMatch = (grid: Grid, p1: Coordinate, p2: Coordinate): boolean => {
  const t1 = grid[p1.y][p1.x];
  const t2 = grid[p2.y][p2.x];
  return t1 !== null && t2 !== null && t1.emoji === t2.emoji && t1.id !== t2.id;
};

// --- Pathfinding Logic ---

// Check if two points can be connected by a straight line (0 turns)
const checkLine = (grid: Grid, p1: Coordinate, p2: Coordinate): Coordinate[] | null => {
  if (p1.x === p2.x) {
    // Vertical
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    for (let y = minY + 1; y < maxY; y++) {
      if (!isEmpty(grid, { x: p1.x, y })) return null;
    }
    return [p1, p2];
  } else if (p1.y === p2.y) {
    // Horizontal
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    for (let x = minX + 1; x < maxX; x++) {
      if (!isEmpty(grid, { x, y: p1.y })) return null;
    }
    return [p1, p2];
  }
  return null;
};

// Check if connected by 1 turn
const checkOneTurn = (grid: Grid, p1: Coordinate, p2: Coordinate): Coordinate[] | null => {
  // Corner 1: (p1.x, p2.y)
  const c1 = { x: p1.x, y: p2.y };
  // Corner 2: (p2.x, p1.y)
  const c2 = { x: p2.x, y: p1.y };

  if (isEmpty(grid, c1)) {
    const path1 = checkLine(grid, p1, c1);
    const path2 = checkLine(grid, c1, p2);
    if (path1 && path2) return [p1, c1, p2];
  }

  if (isEmpty(grid, c2)) {
    const path1 = checkLine(grid, p1, c2);
    const path2 = checkLine(grid, c2, p2);
    if (path1 && path2) return [p1, c2, p2];
  }

  return null;
};

// Check if connected by 2 turns
const checkTwoTurns = (grid: Grid, p1: Coordinate, p2: Coordinate): Coordinate[] | null => {
  const height = grid.length;
  const width = grid[0].length;

  // Scan horizontally from p1
  for (let x = 0; x < width; x++) {
    const pBreak = { x, y: p1.y };
    if (x === p1.x) continue;
    
    // If the path from p1 to break point is clear (straight line)
    const lineToBreak = checkLine(grid, p1, pBreak);
    if (lineToBreak) {
      // Check if we can reach p2 from pBreak with 1 turn
      if (isEmpty(grid, pBreak)) {
        const oneTurnPath = checkOneTurn(grid, pBreak, p2);
        if (oneTurnPath) {
          return [p1, pBreak, ...oneTurnPath.slice(1)];
        }
      }
    }
  }

  // Scan vertically from p1
  for (let y = 0; y < height; y++) {
    const pBreak = { x: p1.x, y };
    if (y === p1.y) continue;

    const lineToBreak = checkLine(grid, p1, pBreak);
    if (lineToBreak) {
      if (isEmpty(grid, pBreak)) {
        const oneTurnPath = checkOneTurn(grid, pBreak, p2);
        if (oneTurnPath) {
          return [p1, pBreak, ...oneTurnPath.slice(1)];
        }
      }
    }
  }
  return null;
};

export const findPath = (grid: Grid, p1: Coordinate, p2: Coordinate): Coordinate[] | null => {
  // 1. Same tile check
  if (p1.x === p2.x && p1.y === p2.y) return null;
  // 2. Logic check: same emoji?
  if (!isMatch(grid, p1, p2)) return null;

  // 3. 0 Turns
  let path = checkLine(grid, p1, p2);
  if (path) return path;

  // 4. 1 Turn
  path = checkOneTurn(grid, p1, p2);
  if (path) return path;

  // 5. 2 Turns
  path = checkTwoTurns(grid, p1, p2);
  if (path) return path;

  return null;
};

// Check if there are any valid moves left (for Game Over or Shuffle logic)
export const hasValidMoves = (grid: Grid): boolean => {
  if (grid.length === 0) return false;
  const height = grid.length;
  const width = grid[0].length;

  const tiles: { coord: Coordinate, emoji: string }[] = [];
  for(let y=0; y<height; y++) {
    for(let x=0; x<width; x++) {
      const t = grid[y][x];
      if (t) tiles.push({ coord: {x, y}, emoji: t.emoji });
    }
  }

  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i].emoji === tiles[j].emoji) {
        if (findPath(grid, tiles[i].coord, tiles[j].coord)) {
          return true;
        }
      }
    }
  }
  return false;
};

// Get a hint
export const getHint = (grid: Grid): [Coordinate, Coordinate] | null => {
  if (grid.length === 0) return null;
  const height = grid.length;
  const width = grid[0].length;

  const tiles: { coord: Coordinate, emoji: string }[] = [];
  for(let y=0; y<height; y++) {
    for(let x=0; x<width; x++) {
      const t = grid[y][x];
      if (t) tiles.push({ coord: {x, y}, emoji: t.emoji });
    }
  }

  // Shuffle search order to give random hints
  tiles.sort(() => Math.random() - 0.5);

  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i].emoji === tiles[j].emoji) {
        if (findPath(grid, tiles[i].coord, tiles[j].coord)) {
          return [tiles[i].coord, tiles[j].coord];
        }
      }
    }
  }
  return null;
};