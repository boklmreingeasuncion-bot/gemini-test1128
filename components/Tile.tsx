import React from 'react';
import { TileData } from '../types';

interface TileProps {
  data: TileData | null;
  isSelected: boolean;
  isHint: boolean;
  isError: boolean;
  onClick: () => void;
  indexDelay?: number; // For staggered entrance
}

const Tile: React.FC<TileProps> = ({ data, isSelected, isHint, isError, onClick, indexDelay = 0 }) => {
  if (!data) {
    return <div className="w-full h-full pointer-events-none" />;
  }

  // Determine classes
  let animationClass = 'tile-pop';
  if (data.matched) {
    animationClass = 'match-explode';
  } else if (isError) {
    animationClass = 'shake bg-red-500/20'; // Red tint on error
  }

  const selectedClass = isSelected 
    ? 'bg-indigo-500 scale-105 ring-4 ring-indigo-300 z-10 shadow-xl' 
    : 'bg-slate-100 hover:bg-slate-200 hover:scale-105 hover:shadow-lg';

  const hintClass = isHint ? 'ring-4 ring-yellow-400 animate-pulse z-10' : '';

  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${indexDelay}ms` }}
      className={`
        w-full h-full rounded-lg text-3xl flex items-center justify-center
        transition-all duration-200 shadow-md
        select-none ${animationClass}
        ${!data.matched && !isError ? selectedClass : ''}
        ${hintClass}
      `}
    >
      {data.emoji}
    </button>
  );
};

export default Tile;