// 🎮 GAME SKILL - Generación de juegos con Canvas/WebGL
// Especializado en crear juegos interactivos para Next.js/React

export interface GameConfig {
  type: GameType
  name: string
  width: number
  height: number
  colors: {
    primary: string
    secondary: string
    background: string
    accent: string
  }
  difficulty: 'easy' | 'medium' | 'hard'
}

export type GameType = 
  | 'snake'
  | 'pong'
  | 'tetris'
  | 'breakout'
  | 'flappy'
  | 'memory'
  | 'puzzle'
  | 'platformer'

export const GAME_TEMPLATES: Record<GameType, {
  name: string
  description: string
  complexity: number
  features: string[]
}> = {
  snake: {
    name: 'Snake Clásico',
    description: 'El juego clásico de la serpiente que come y crece',
    complexity: 1,
    features: ['Controles de teclado', 'Puntuación', 'Game Over', 'Reinicio'],
  },
  pong: {
    name: 'Pong',
    description: 'El clásico juego de ping pong para 1 o 2 jugadores',
    complexity: 1,
    features: ['1 o 2 jugadores', 'IA básica', 'Puntuación', 'Controles touch'],
  },
  tetris: {
    name: 'Tetris',
    description: 'El juego de bloques que caen',
    complexity: 2,
    features: ['Rotación de piezas', 'Niveles', 'Puntuación', 'Next piece preview'],
  },
  breakout: {
    name: 'Breakout',
    description: 'Rompe los bloques con la pelota',
    complexity: 2,
    features: ['Power-ups', 'Múltiples niveles', 'Vidas', 'Efectos de sonido'],
  },
  flappy: {
    name: 'Flappy Bird',
    description: 'Vuela entre los obstáculos',
    complexity: 1,
    features: ['Física de gravedad', 'Obstáculos aleatorios', 'High score', 'Mobile friendly'],
  },
  memory: {
    name: 'Memory Match',
    description: 'Encuentra las parejas de cartas',
    complexity: 1,
    features: ['Diferentes dificultades', 'Temporizador', 'Animaciones flip', 'Sonidos'],
  },
  puzzle: {
    name: 'Puzzle Slider',
    description: 'Ordena las piezas del rompecabezas',
    complexity: 2,
    features: ['Imagen personalizable', 'Contador de movimientos', 'Verificación de solución'],
  },
  platformer: {
    name: 'Platformer',
    description: 'Juego de plataformas con saltos y obstáculos',
    complexity: 3,
    features: ['Física de salto', 'Enemigos', 'Coleccionables', 'Múltiples niveles'],
  },
}

// Prompt maestro para el Game Agent
export const MASTER_GAME_PROMPT = `Eres un Senior Game Developer especializado en juegos web con Canvas 2D y React.

OBJETIVO: Generar código de juegos completo, funcional y listo para usar en Next.js/React.

TECNOLOGÍAS:
- React 18 con Hooks (useState, useEffect, useRef, useCallback)
- Canvas 2D API (getContext('2d'))
- requestAnimationFrame para game loop suave
- Eventos de teclado y touch para controles
- TypeScript estricto

ESTRUCTURA DE UN COMPONENTE DE JUEGO:
\`\`\`typescript
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface GameState {
  // Estado del juego
}

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameOver'>('menu')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  
  // Game loop
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear
    ctx.fillStyle = '#1A1A1A'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Update game state
    // ...
    
    // Draw
    // ...
    
    // Request next frame
    if (gameState === 'playing') {
      requestAnimationFrame(gameLoop)
    }
  }, [gameState])
  
  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle input
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  // Start game loop
  useEffect(() => {
    if (gameState === 'playing') {
      requestAnimationFrame(gameLoop)
    }
  }, [gameState, gameLoop])
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <h1 className="text-4xl font-bold text-white mb-4">Snake Game</h1>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="border-4 border-green-500 rounded-lg"
        />
        {gameState === 'menu' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
            <button
              onClick={() => setGameState('playing')}
              className="px-8 py-4 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600"
            >
              JUGAR
            </button>
          </div>
        )}
        {gameState === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg">
            <p className="text-white text-2xl mb-4">Game Over!</p>
            <p className="text-green-400 text-xl mb-4">Score: {score}</p>
            <button
              onClick={() => { setScore(0); setGameState('playing'); }}
              className="px-8 py-4 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600"
            >
              REINICIAR
            </button>
          </div>
        )}
      </div>
      <div className="mt-4 text-white">
        <p>Score: {score} | High Score: {highScore}</p>
      </div>
      <p className="mt-4 text-gray-400">Usa las flechas ← ↑ → ↓ para moverte</p>
    </div>
  )
}
\`\`\`

PATRONES IMPORTANTES:

1. GAME LOOP:
- Usar requestAnimationFrame para 60 FPS
- Separar update (lógica) de draw (render)
- Controlar deltaTime para movimiento consistente

2. ESTADO DEL JUEGO:
- Menu inicial con botón "Jugar"
- Estado "playing" activo
- Pausa con tecla Escape
- Game Over con opción de reinicio

3. CONTROLES:
- Teclado: flechas, WASD, espacio
- Touch: swipes, botones virtuales
- Prevenir scroll en mobile (e.preventDefault())

4. COLISIONES:
- Detección de bounds (paredes)
- Colisión entre objetos (AABB)
- Respuesta a colisión

5. PUNTUACIÓN:
- Score en tiempo real
- High Score persistido (localStorage)
- Animación de puntos ganados

6. ESTILOS:
- Canvas centrado y responsive
- Overlay para menús (absolute positioning)
- Colores consistentes con el sistema de diseño

GENERA CÓDIGO COMPLETO, FUNCIONAL Y LISTO PARA USAR.
Incluye TODOS los estados del juego, controles, y lógica de colisión.
El juego debe funcionar inmediatamente al copiar el código.`

// Detectar tipo de juego desde descripción
export function detectGameType(description: string): GameType | null {
  const d = description.toLowerCase()
  
  if (d.includes('snake') || d.includes('serpiente') || d.includes('vibora')) return 'snake'
  if (d.includes('pong') || d.includes('ping pong') || d.includes('tenis')) return 'pong'
  if (d.includes('tetris') || d.includes('bloques caen')) return 'tetris'
  if (d.includes('breakout') || d.includes('arkanoid') || d.includes('rompe bloques')) return 'breakout'
  if (d.includes('flappy') || d.includes('pajaro') || d.includes('vuela')) return 'flappy'
  if (d.includes('memory') || d.includes('memoria') || d.includes('parejas') || d.includes('cartas')) return 'memory'
  if (d.includes('puzzle') || d.includes('rompecabezas') || d.includes('slider')) return 'puzzle'
  if (d.includes('plataformas') || d.includes('platformer') || d.includes('mario')) return 'platformer'
  
  return null
}

// Generar configuración de juego
export function generateGameConfig(
  type: GameType,
  name: string,
  colors?: Partial<GameConfig['colors']>
): GameConfig {
  const defaultColors = {
    primary: '#2E4036',     // Verde Musgo
    secondary: '#CC5833',   // Arcilla
    background: '#1A1A1A',  // Carbón
    accent: '#F2F0E9',      // Crema
  }
  
  return {
    type,
    name,
    width: 400,
    height: 400,
    colors: { ...defaultColors, ...colors },
    difficulty: 'medium',
  }
}

// Exportar skill info para el sistema
export const GAME_SKILL_INFO = {
  id: 'game-skill',
  name: '🎮 Game Agent',
  description: 'Crea juegos interactivos con Canvas 2D',
  capabilities: [
    'Snake, Pong, Tetris, Breakout',
    'Flappy Bird, Memory Match',
    'Puzzle Slider, Platformer',
    'Controles touch y teclado',
    'Puntuación y high scores',
  ],
  supportedGames: Object.keys(GAME_TEMPLATES),
  status: 'active' as const,
}
