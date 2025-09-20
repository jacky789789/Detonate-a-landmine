import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../styles/minesweeper.css';

interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborCount: number;
}

type GameState = 'playing' | 'won' | 'lost';
type Difficulty = 'beginner' | 'intermediate' | 'expert';

interface DifficultyConfig {
  rows: number;
  cols: number;
  mines: number;
  name: string;
}

const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  beginner: { rows: 9, cols: 9, mines: 10, name: '初級' },
  intermediate: { rows: 16, cols: 16, mines: 40, name: '中級' },
  expert: { rows: 16, cols: 30, mines: 99, name: '高級' }
};

const Minesweeper: React.FC = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const config = DIFFICULTY_CONFIGS[difficulty];
  const ROWS = config.rows;
  const COLS = config.cols;
  const MINES = config.mines;

  const [board, setBoard] = useState<Cell[][]>([]);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [minesLeft, setMinesLeft] = useState(MINES);
  const [isFirstClick, setIsFirstClick] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize empty board
  const createEmptyBoard = useCallback((): Cell[][] => {
    return Array(ROWS).fill(null).map(() =>
      Array(COLS).fill(null).map(() => ({
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborCount: 0
      }))
    );
  }, [ROWS, COLS]);

  // Place mines randomly, avoiding the first clicked cell
  const placeMines = useCallback((board: Cell[][], firstClickRow: number, firstClickCol: number): Cell[][] => {
    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    let minesPlaced = 0;

    while (minesPlaced < MINES) {
      const row = Math.floor(Math.random() * ROWS);
      const col = Math.floor(Math.random() * COLS);

      // Don't place mine on first click or if already has mine
      if ((row !== firstClickRow || col !== firstClickCol) && !newBoard[row][col].isMine) {
        newBoard[row][col].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate neighbor counts
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!newBoard[row][col].isMine) {
          let count = 0;
          for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
              const newRow = row + i;
              const newCol = col + j;
              if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
                if (newBoard[newRow][newCol].isMine) {
                  count++;
                }
              }
            }
          }
          newBoard[row][col].neighborCount = count;
        }
      }
    }

    return newBoard;
  }, [ROWS, COLS, MINES]);

  // Reveal cell and adjacent empty cells
  const revealCell = useCallback((board: Cell[][], row: number, col: number): Cell[][] => {
    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    
    const reveal = (r: number, c: number) => {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      if (newBoard[r][c].isRevealed || newBoard[r][c].isFlagged) return;

      newBoard[r][c].isRevealed = true;

      // If cell has no adjacent mines, reveal neighbors
      if (newBoard[r][c].neighborCount === 0 && !newBoard[r][c].isMine) {
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            reveal(r + i, c + j);
          }
        }
      }
    };

    reveal(row, col);
    return newBoard;
  }, [ROWS, COLS]);

  // Handle left click
  const handleLeftClick = useCallback((row: number, col: number) => {
    if (gameState !== 'playing') return;

    setBoard(currentBoard => {
      let newBoard = currentBoard.map(row => row.map(cell => ({ ...cell })));

      // First click - initialize board with mines
      if (isFirstClick) {
        newBoard = placeMines(newBoard, row, col);
        setIsFirstClick(false);
        
        // Start timer
        timerRef.current = setInterval(() => {
          setTimeElapsed(prev => prev + 1);
        }, 1000);
      }

      if (newBoard[row][col].isFlagged || newBoard[row][col].isRevealed) {
        return newBoard;
      }

      // Reveal the cell
      newBoard = revealCell(newBoard, row, col);

      // Check if hit mine
      if (newBoard[row][col].isMine) {
        setGameState('lost');
        // Reveal all mines
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (newBoard[r][c].isMine) {
              newBoard[r][c].isRevealed = true;
            }
          }
        }
      } else {
        // Check for win condition
        let unrevealedNonMines = 0;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!newBoard[r][c].isMine && !newBoard[r][c].isRevealed) {
              unrevealedNonMines++;
            }
          }
        }
        if (unrevealedNonMines === 0) {
          setGameState('won');
        }
      }

      return newBoard;
    });
  }, [gameState, isFirstClick, placeMines, revealCell]);

  // Handle right click (flagging)
  const handleRightClick = useCallback((e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    if (gameState !== 'playing') return;

    setBoard(currentBoard => {
      const newBoard = currentBoard.map(row => row.map(cell => ({ ...cell })));
      
      if (newBoard[row][col].isRevealed) return newBoard;

      newBoard[row][col].isFlagged = !newBoard[row][col].isFlagged;
      return newBoard;
    });
  }, [gameState]);

  // Reset game
  const resetGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setBoard(createEmptyBoard());
    setGameState('playing');
    setTimeElapsed(0);
    setMinesLeft(MINES);
    setIsFirstClick(true);
  }, [createEmptyBoard]);

  // Update mines left counter
  useEffect(() => {
    const flaggedCount = board.flat().filter(cell => cell.isFlagged).length;
    setMinesLeft(MINES - flaggedCount);
  }, [board]);

  // Stop timer when game ends
  useEffect(() => {
    if (gameState !== 'playing' && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [gameState]);

  // Initialize board on mount
  useEffect(() => {
    setBoard(createEmptyBoard());
  }, [createEmptyBoard]);

  // Format time display
  const formatTime = (seconds: number): string => {
    return seconds.toString().padStart(3, '0');
  };

  // Get cell display content
  const getCellContent = (cell: Cell): string => {
    if (cell.isFlagged) return '🚩';
    if (!cell.isRevealed) return '';
    if (cell.isMine) return '💣';
    return cell.neighborCount > 0 ? cell.neighborCount.toString() : '';
  };

  // Get cell CSS class
  const getCellClass = (cell: Cell): string => {
    let className = 'cell';
    
    if (cell.isRevealed) {
      className += ' revealed';
      if (cell.isMine) {
        className += ' mine';
      } else if (cell.neighborCount > 0) {
        className += ` number-${cell.neighborCount}`;
      }
    }
    
    return className;
  };

  // Get game status emoji
  const getGameStatusEmoji = (): string => {
    switch (gameState) {
      case 'won': return '😎';
      case 'lost': return '😵';
      default: return '🙂';
    }
  };

  return (
    <div className="minesweeper">
      <div className="game-header">
        <div className="counter">{minesLeft.toString().padStart(3, '0')}</div>
        <button className="reset-btn" onClick={resetGame}>
          {getGameStatusEmoji()}
        </button>
        <div className="timer">{formatTime(timeElapsed)}</div>
      </div>
      
      <div className="game-board">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="row">
            {row.map((cell, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                className={getCellClass(cell)}
                onClick={() => handleLeftClick(rowIndex, colIndex)}
                onContextMenu={(e) => handleRightClick(e, rowIndex, colIndex)}
              >
                {getCellContent(cell)}
              </button>
            ))}
          </div>
        ))}
      </div>
      
      {gameState !== 'playing' && (
        <div className="game-over-message">
          {gameState === 'won' ? '🎉 You Won!' : '💥 Game Over!'}
        </div>
      )}
    </div>
  );
};

export default Minesweeper;
