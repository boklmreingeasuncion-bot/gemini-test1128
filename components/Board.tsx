import React from 'react';
import { Grid, Coordinate } from '../types';
import Tile from './Tile';

interface BoardProps {
  grid: Grid;
  selected: Coordinate | null;
  hint: Coordinate[] | null;
  errorTile: Coordinate | null;
  onTileClick: (coord: Coordinate) => void;
  connectionPath: Coordinate[] | null;
}

const Board: React.FC<BoardProps> = ({ grid, selected, hint, errorTile, onTileClick, connectionPath }) => {
  if (!grid || grid.length === 0) return null;
  
  const gridHeight = grid.length;
  const gridWidth = grid[0].length;

  // Calculate relative line segments for the SVG overlay
  const renderPath = () => {
    if (!connectionPath || connectionPath.length < 2) return null;

    const points = connectionPath.map(p => {
        const x = (p.x * 100) / gridWidth + (100 / gridWidth) / 2;
        const y = (p.y * 100) / gridHeight + (100 / gridHeight) / 2;
        return `${x},${y}`;
    }).join(' ');

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
        <polyline
          points={points}
          fill="none"
          stroke="#6366f1" // Indigo-500
          strokeWidth="1.5%"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-lg"
          style={{ filter: 'drop-shadow(0 0 4px rgba(99, 102, 241, 0.5))' }}
        />
      </svg>
    );
  };

  return (
    <div className="relative p-4 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 fade-in-up">
      {/* Grid Container */}
      <div 
        className="grid gap-2 relative z-10"
        style={{
          gridTemplateColumns: `repeat(${gridWidth}, minmax(0, 1fr))`,
          aspectRatio: `${gridWidth}/${gridHeight}`,
          width: '100%',
          maxWidth: '800px'
        }}
      >
        {grid.map((row, y) => (
          row.map((tile, x) => {
            const isSelected = selected?.x === x && selected?.y === y;
            const isHint = hint ? hint.some(h => h.x === x && h.y === y) : false;
            // Check if this tile is the one causing an error
            const isError = errorTile?.x === x && errorTile?.y === y;
            
            // Calculate a staggered delay based on position for the entrance animation
            const delay = (y * gridWidth + x) * 15;

            const isPadding = x === 0 || y === 0 || x === gridWidth - 1 || y === gridHeight - 1;
            
            return (
              <div key={`${x}-${y}`} className={`relative ${isPadding ? 'pointer-events-none' : ''}`} style={{ aspectRatio: '1' }}>
                 {!isPadding && (
                   <Tile 
                     data={tile} 
                     isSelected={isSelected} 
                     isHint={isHint}
                     isError={isError}
                     indexDelay={delay}
                     onClick={() => onTileClick({ x, y })} 
                   />
                 )}
              </div>
            );
          })
        ))}
      </div>
      
      {/* Connection Line Layer */}
      {renderPath()}
    </div>
  );
};

export default Board;