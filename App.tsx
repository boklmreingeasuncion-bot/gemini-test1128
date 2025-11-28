import React, { useState, useEffect, useCallback } from 'react';
import { 
  Grid, Coordinate, TileData, GameState 
} from './types';
import Board from './components/Board';
import { findPath, hasValidMoves, getHint } from './services/gameLogic';
import { generateThemeEmojis } from './services/geminiService';
import * as audio from './services/audioService';
import { Sparkles, RefreshCw, Lightbulb, Play, RotateCcw, Volume2, VolumeX, Grid3X3, Wand2, Signal } from 'lucide-react';

// --- Configuration ---
const PRESET_THEMES: Record<string, { name: string, emojis: string[] }> = {
  animals: { name: '🦁 可爱动物', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔'] },
  fruits: { name: '🍎 新鲜水果', emojis: ['🍎', '🍌', '🍇', '🍉', '🍒', '🍓', '🥑', '🥕', '🌽', '🥦', '🍄', '🥜', '🥐', '🥨', '🧀', '🥩'] },
  sports: { name: '⚽ 运动体育', emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '🥊', '🛹', '⛳', '⛸️', '🏹'] },
  weather: { name: '☀️ 自然天气', emojis: ['☀️', '🌤️', '☁️', '🌧️', '⛈️', '🌩️', '❄️', '☃️', '🌬️', '🌈', '⭐', '🌙', '🌊', '🔥', '💧', '⚡'] },
  expressions: { name: '😀 逗趣表情', emojis: ['😀', '😂', '😍', '😎', '😡', '😱', '🤔', '😴', '🤢', '🤡', '👻', '👽', '🤖', '💩', '👺', '🙈'] },
  transport: { name: '🚗 交通工具', emojis: ['🚗', '🚕', '🚙', '🚌', '🚓', '🚑', '🚒', '🚲', '🛵', '🚂', '✈️', '🚀', '🛸', '🚁', '🛶', '🚢'] },
};

type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

const DIFFICULTIES: Record<DifficultyLevel, { label: string; width: number; height: number; time: number }> = {
  EASY: { label: '简单 (6x4)', width: 6, height: 4, time: 90 },
  MEDIUM: { label: '中等 (8x6)', width: 8, height: 6, time: 180 },
  HARD: { label: '困难 (10x8)', width: 10, height: 8, time: 300 },
};

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [grid, setGrid] = useState<Grid>([]);
  const [selected, setSelected] = useState<Coordinate | null>(null);
  const [path, setPath] = useState<Coordinate[] | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);
  const [emojis, setEmojis] = useState<string[]>(PRESET_THEMES.fruits.emojis);
  const [selectedThemeKey, setSelectedThemeKey] = useState<string>('fruits');
  const [customTheme, setCustomTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hint, setHint] = useState<Coordinate[] | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('MEDIUM');
  
  // Animation State
  const [errorTile, setErrorTile] = useState<Coordinate | null>(null);

  // Initialize Board
  const initGame = useCallback((emojiSet: string[] = emojis, diff: DifficultyLevel = difficulty) => {
    const config = DIFFICULTIES[diff];
    const boardWidth = config.width;
    const boardHeight = config.height;
    
    // Internal grid includes padding ring (1 on each side)
    const gridWidth = boardWidth + 2;
    const gridHeight = boardHeight + 2;

    // 1. Create a flattened array of pairs
    const totalSlots = boardWidth * boardHeight;
    const pairCount = totalSlots / 2;
    
    let tiles: TileData[] = [];
    for (let i = 0; i < pairCount; i++) {
      const emoji = emojiSet[i % emojiSet.length];
      tiles.push({ id: `p${i}-a`, emoji, matched: false });
      tiles.push({ id: `p${i}-b`, emoji, matched: false });
    }
    
    // Shuffle
    tiles = tiles.sort(() => Math.random() - 0.5);

    // 2. Fill the padded grid
    const newGrid: Grid = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(null));
    
    let tileIdx = 0;
    for (let y = 1; y <= boardHeight; y++) {
      for (let x = 1; x <= boardWidth; x++) {
        newGrid[y][x] = tiles[tileIdx++];
      }
    }

    setGrid(newGrid);
    setGameState(GameState.PLAYING);
    setScore(0);
    setTimeLeft(config.time);
    setSelected(null);
    setPath(null);
    setHint(null);
    setErrorTile(null);
    audio.playSelect(); 
  }, [emojis, difficulty]);

  // Timer
  useEffect(() => {
    let timer: number;
    if (gameState === GameState.PLAYING) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState(GameState.GAME_OVER);
            audio.playGameOver();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState]);

  // Toggle Mute
  const toggleMute = () => {
    const newVal = !isMuted;
    setIsMuted(newVal);
    audio.setMuted(newVal);
  };

  // Switch Preset Theme
  const handleThemeChange = (key: string) => {
    setSelectedThemeKey(key);
    if (PRESET_THEMES[key]) {
      setEmojis(PRESET_THEMES[key].emojis);
    }
  };

  // Handle Tile Click
  const handleTileClick = (coord: Coordinate) => {
    if (path) return; // Wait for animation
    if (grid[coord.y][coord.x]?.matched) return; // Already matched, waiting for cleanup

    // If clicking same tile, deselect
    if (selected?.x === coord.x && selected?.y === coord.y) {
      setSelected(null);
      audio.playSelect();
      return;
    }

    if (!selected) {
      setSelected(coord);
      setHint(null); // Clear hint on interaction
      audio.playSelect();
    } else {
      // Try to match
      const foundPath = findPath(grid, selected, coord);
      
      if (foundPath) {
        // MATCH FOUND!
        setPath(foundPath);
        audio.playMatch();
        
        // 1. Mark as matched in the grid immediately to trigger animation
        setGrid(prev => {
          const newGrid = prev.map(row => row.map(t => t ? {...t} : null));
          if (newGrid[selected.y][selected.x]) newGrid[selected.y][selected.x]!.matched = true;
          if (newGrid[coord.y][coord.x]) newGrid[coord.y][coord.x]!.matched = true;
          return newGrid;
        });

        // 2. Wait for animation to finish, then remove tiles
        setTimeout(() => {
          setGrid(prevGrid => {
            const newGrid = prevGrid.map(row => [...row]);
            newGrid[selected.y][selected.x] = null;
            newGrid[coord.y][coord.x] = null;
            return newGrid;
          });
          setScore(s => s + 100 + (timeLeft * 0.1)); // Bonus for speed
          setSelected(null);
          setPath(null);

          // Check Win Condition: Calculate visible tiles *before* this successful match was removed
          // But since state is async, we count from current 'grid' which still has them but marked matched.
          // Wait, 'prevGrid' in setGrid above has nulls.
          // It's cleaner to count visible tiles in the Effect or right here based on `grid` state prior to nullification.
          // Let's use a simple valid move check. If 0 tiles, Win.
          let visibleCount = 0;
          grid.forEach(row => row.forEach(t => { if(t && !t.matched) visibleCount++; }));
          // We matched 2, so if visibleCount was 2, now 0.
          if (visibleCount <= 2) {
             setGameState(GameState.WON);
             audio.playWin();
          }
        }, 300); // Wait 300ms for explode animation
      } else {
        // INVALID MATCH
        audio.playError();
        setErrorTile(coord); // Shake the clicked tile
        
        setTimeout(() => setErrorTile(null), 500);
        setSelected(coord); 
      }
    }
  };

  // Check valid moves after grid update (useEffect)
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      if (grid.length === 0) return;

      let hasTiles = false;
      const height = grid.length;
      const width = grid[0].length;
      for(let y=0; y<height; y++) {
        for(let x=0; x<width; x++) {
          if (grid[y][x]) { hasTiles = true; break; }
        }
      }
      
      if (!hasTiles) {
         setGameState(GameState.WON);
      } else if (hasTiles && !hasValidMoves(grid)) {
        handleShuffle();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, gameState]);

  const handleShuffle = () => {
    audio.playShuffle();
    setGrid(prev => {
      if (prev.length === 0) return prev;
      const height = prev.length;
      const width = prev[0].length;

      const remainingTiles: TileData[] = [];
      prev.forEach(row => row.forEach(t => { if (t) remainingTiles.push(t); }));
      remainingTiles.sort(() => Math.random() - 0.5);
      
      const positions: Coordinate[] = [];
      const data: TileData[] = [];
      for(let y=0; y<height; y++) {
        for(let x=0; x<width; x++) {
          if (prev[y][x]) {
            positions.push({x, y});
            data.push(prev[y][x]!);
          }
        }
      }
      
      data.sort(() => Math.random() - 0.5);
      
      const nextGrid = Array(height).fill(null).map(() => Array(width).fill(null));
      positions.forEach((pos, i) => {
        nextGrid[pos.y][pos.x] = data[i];
      });
      return nextGrid;
    });
    setHint(null);
  };

  const handleHint = () => {
    const h = getHint(grid);
    if (h) {
      audio.playSelect();
      setHint(h);
      setScore(s => Math.max(0, s - 50));
    } else {
      audio.playError();
    }
  };

  const handleGeminiTheme = async () => {
    if (!customTheme.trim()) return;
    setIsGenerating(true);
    try {
      const newEmojis = await generateThemeEmojis(customTheme);
      setEmojis(newEmojis);
      setSelectedThemeKey('custom'); // visual indicator
      initGame(newEmojis);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartGame = () => {
      initGame(); 
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      
      {/* Header */}
      <div className="w-full max-w-4xl mb-6 flex flex-col md:flex-row items-center justify-between gap-4 fade-in-up">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Gemini 智能连连看
          </h1>
          <p className="text-slate-400 text-sm">连接相同图案，路径转弯不超过两次</p>
        </div>

        <div className="flex items-center gap-4">
           {/* Mute Button */}
           <button 
             onClick={toggleMute}
             className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors border border-slate-700 shadow-sm"
             title={isMuted ? "取消静音" : "静音"}
           >
             {isMuted ? <VolumeX className="w-5 h-5 text-slate-400" /> : <Volume2 className="w-5 h-5 text-indigo-400" />}
           </button>

          {/* Stats */}
          {gameState === GameState.PLAYING && (
            <div className="flex gap-6 bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm">
              <div className="text-center">
                <div className="text-xs text-slate-400 uppercase">得分</div>
                <div className="text-xl font-mono font-bold text-yellow-400 transition-all">{Math.floor(score)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-400 uppercase">剩余时间</div>
                <div className={`text-xl font-mono font-bold ${timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row gap-6 items-start w-full max-w-5xl">
        
        {/* Left Sidebar: Controls */}
        <div className="w-full md:w-72 flex flex-col gap-4 order-2 md:order-1 fade-in-up" style={{ animationDelay: '100ms' }}>
          
          {/* Difficulty Selection */}
           <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
             <h3 className="flex items-center gap-2 font-semibold text-indigo-300 mb-4">
              <Signal className="w-4 h-4" /> 难度选择
            </h3>
             <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFFICULTIES) as DifficultyLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setDifficulty(level);
                    if (gameState !== GameState.PLAYING) {
                      audio.playSelect();
                    }
                  }}
                  disabled={gameState === GameState.PLAYING}
                  className={`
                    py-2 rounded text-xs font-bold transition-all
                    ${difficulty === level 
                      ? 'bg-indigo-600 text-white shadow-md scale-105' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {level === 'EASY' ? '简单' : level === 'MEDIUM' ? '中等' : '困难'}
                </button>
              ))}
            </div>
             <p className="text-xs text-slate-400 mt-2 text-center">
               {DIFFICULTIES[difficulty].label} - {DIFFICULTIES[difficulty].time}秒
             </p>
           </div>

          {/* Theme Selection Section */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
             <h3 className="flex items-center gap-2 font-semibold text-indigo-300 mb-4">
              <Grid3X3 className="w-4 h-4" /> 选择主题
            </h3>
            
            {/* Dropdown */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">预设主题</label>
              <select 
                value={selectedThemeKey}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                disabled={gameState === GameState.PLAYING}
              >
                {Object.entries(PRESET_THEMES).map(([key, theme]) => (
                  <option key={key} value={key}>{theme.name}</option>
                ))}
                {selectedThemeKey === 'custom' && <option value="custom">✨ 自定义主题</option>}
              </select>
            </div>

            {/* AI Custom */}
            <div className="border-t border-slate-700 pt-4 mt-2">
                <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
                   <Sparkles className="w-3 h-3 text-pink-400" /> AI 定制 (Gemini)
                </label>
                <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="输入主题 (如: 寿司)"
                    value={customTheme}
                    onChange={(e) => setCustomTheme(e.target.value)}
                    disabled={gameState === GameState.PLAYING}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                />
                <button
                    onClick={handleGeminiTheme}
                    disabled={isGenerating || !customTheme || gameState === GameState.PLAYING}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded transition-colors flex items-center justify-center"
                    title="生成主题"
                >
                    {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </button>
                </div>
            </div>
          </div>

          {/* Game Controls */}
          {gameState === GameState.PLAYING && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex flex-col gap-3 fade-in-up" style={{ animationDelay: '200ms' }}>
               <button 
                onClick={handleHint}
                className="flex items-center justify-center gap-2 w-full bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-600/50 py-2 rounded transition-colors"
              >
                <Lightbulb className="w-4 h-4" /> 提示 (-50分)
              </button>
               <button 
                onClick={handleShuffle}
                className="flex items-center justify-center gap-2 w-full bg-slate-700 hover:bg-slate-600 py-2 rounded transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> 洗牌
              </button>
              <button 
                onClick={() => setGameState(GameState.MENU)}
                className="text-slate-400 hover:text-white text-sm mt-2 transition-colors"
              >
                退出游戏
              </button>
            </div>
          )}
        </div>

        {/* Center: Game Board */}
        <div className="flex-1 w-full flex justify-center order-1 md:order-2">
          {gameState === GameState.MENU ? (
            <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center fade-in-up">
              <div className="text-6xl mb-6 animate-bounce">🧩</div>
              <h2 className="text-2xl font-bold mb-4 text-white">准备好了吗？</h2>
              <p className="text-slate-400 mb-8">
                找出所有相同的方块并消除它们。<br/>
                <span className="text-indigo-400 text-sm">当前主题: {selectedThemeKey === 'custom' ? customTheme : PRESET_THEMES[selectedThemeKey]?.name}</span>
                <br/>
                <span className="text-cyan-400 text-sm">当前难度: {DIFFICULTIES[difficulty].label}</span>
              </p>
              <button
                onClick={handleStartGame}
                className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
              >
                <Play className="w-6 h-6" /> 开始游戏
              </button>
            </div>
          ) : gameState === GameState.WON ? (
             <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-green-500 text-center fade-in-up">
              <div className="text-6xl mb-6">🏆</div>
              <h2 className="text-3xl font-bold mb-2 text-white">挑战成功！</h2>
              <p className="text-green-400 text-xl font-mono mb-6">最终得分: {Math.floor(score)}</p>
              <button
                onClick={handleStartGame}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full shadow-lg flex items-center justify-center gap-2 mx-auto transition-transform hover:scale-105"
              >
                <RotateCcw className="w-5 h-5" /> 再玩一次
              </button>
            </div>
          ) : gameState === GameState.GAME_OVER ? (
            <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-red-500 text-center fade-in-up">
              <div className="text-6xl mb-6">⏰</div>
              <h2 className="text-3xl font-bold mb-2 text-white">时间到！</h2>
              <p className="text-slate-400 mb-6">动作要快，姿势要帅，下次继续努力。</p>
              <button
                onClick={handleStartGame}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-8 rounded-full shadow-lg flex items-center justify-center gap-2 mx-auto transition-transform hover:scale-105"
              >
                <RotateCcw className="w-5 h-5" /> 重新挑战
              </button>
            </div>
          ) : (
            <Board 
              grid={grid} 
              selected={selected} 
              hint={hint}
              errorTile={errorTile}
              onTileClick={handleTileClick} 
              connectionPath={path} 
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;