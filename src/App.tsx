import React, { useState, useEffect, useCallback } from 'react'
import { GameState, PlayerId, Card, TrumpCall, Phase, TeamId, Suit, SUIT_SYMBOLS, RANK_ORDER, getRankIndex, getPlayerTeam, PLAYER_ORDER, getNextPlayer } from './engine/types'
import { createInitialState, legalMoves, applyMove, applyBid, applyPass, applyDealerChoice, endOfHandScoring } from './engine/rules'
import { createBot, BotLevel } from './bots'
import { getHint, analyzeGame, computeGameScore } from './analysis'

// Player positions
const POSITIONS = ['north', 'east', 'south', 'west'] as const

// Component for a single card
const CardView: React.FC<{
  card: Card | null
  small?: boolean
  highlighted?: boolean
  onClick?: () => void
  playable?: boolean
  hidden?: boolean
}> = ({ card, small = false, highlighted = false, onClick, playable = false, hidden = false }) => {
  const [isHovered, setIsHovered] = useState(false)
  
  if (!card || hidden) {
    return (
      <div
        className={`card card-back ${small ? 'card-small' : ''}`}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      />
    )
  }
  
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
  
  return (
    <div
      className={`card ${small ? 'card-small' : ''} ${highlighted ? 'card-highlighted' : ''} ${playable ? 'card-playable' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transform: isHovered && onClick ? 'translateY(-10px)' : undefined,
        color: isRed ? '#e53e3e' : '#1a202c',
        borderColor: playable ? '#48bb78' : highlighted ? '#ed8936' : undefined,
        boxShadow: playable ? '0 0 8px #48bb78' : undefined
      }}
    >
      <div className="card-corner top-left">
        <span>{card.rank}</span>
        <span>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
      <div className="card-center">
        <span>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
      <div className="card-corner bottom-right">
        <span>{card.rank}</span>
        <span>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
    </div>
  )
}

// Score board component
const ScoreBoard: React.FC<{
  handScores: Record<TeamId, number>
  matchScores: Record<TeamId, number>
  trump: Suit | null
  declarer: PlayerId | null
}> = ({ handScores, matchScores, trump, declarer }) => {
  return (
    <div className="scoreboard">
      <div className="scoreboard-section">
        <div className="score-title">Current Hand</div>
        <div className="score-row">
          <span className="team team1">Team 1:</span>
          <span>{handScores.team1}</span>
        </div>
        <div className="score-row">
          <span className="team team2">Team 2:</span>
          <span>{handScores.team2}</span>
        </div>
      </div>
      <div className="scoreboard-section">
        <div className="score-title">Match Score</div>
        <div className="score-row">
          <span className="team team1">Team 1:</span>
          <span>{matchScores.team1}</span>
        </div>
        <div className="score-row">
          <span className="team team2">Team 2:</span>
          <span>{matchScores.team2}</span>
        </div>
      </div>
      <div className="scoreboard-section">
        <div className="score-title">Contract</div>
        {trump ? (
          <div className="trump-indicator">
            Trump: <span className="trump-suit">{SUIT_SYMBOLS[trump]}</span> {trump}
            {declarer && <span className="declarer"> (Declarer: {declarer})</span>}
          </div>
        ) : (
          <div className="no-trump">Bidding in progress...</div>
        )}
      </div>
    </div>
  )
}

// Player seat component
const PlayerSeat: React.FC<{
  position: 'north' | 'east' | 'south' | 'west'
  name: string
  team: TeamId
  cardCount: number
  isCurrentTurn: boolean
  isDeclarer: boolean
}> = ({ position, name, team, cardCount, isCurrentTurn, isDeclarer }) => {
  const positionClass = `seat seat-${position}`
  
  return (
    <div className={positionClass}>
      <div className={`seat-indicator ${isCurrentTurn ? 'active' : ''}`}>
        {isCurrentTurn && <span className="turn-arrow">▶</span>}
      </div>
      <div className={`seat-name ${team} ${isDeclarer ? 'declarer' : ''}`}>
        {name}
        {isDeclarer && <span className="declarer-badge">D</span>}
      </div>
      <div className="seat-cards">
        {Array(Math.min(cardCount, 8)).fill(0).map((_, i) => (
          <div key={i} className="card-back card-small" />
        ))}
      </div>
    </div>
  )
}

// Hint panel component
const HintPanel: React.FC<{
  hint: { card: Card; explanation: string } | null
  analysis: string | null
  onClose: () => void
}> = ({ hint, analysis, onClose }) => {
  if (!hint && !analysis) return null
  
  return (
    <div className="hint-panel">
      <div className="hint-header">
        <span>💡 Suggestion</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      {hint && (
        <div className="hint-content">
          <div className="hint-card">
            <CardView card={hint.card} />
          </div>
          <div className="hint-explanation">{hint.explanation}</div>
        </div>
      )}
      {analysis && (
        <div className="analysis-content">
          <pre>{analysis}</pre>
        </div>
      )}
    </div>
  )
}

// Main App component
const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState())
  const [bots] = useState<Record<PlayerId, BotLevel>>({
    north: createBot('north', 1, 'North Bot'),
    east: createBot('east', 1, 'East Bot'),
    west: createBot('west', 1, 'West Bot'),
    south: createBot('south', 1, 'Player')
  })
  const [hint, setHint] = useState<{ card: Card; explanation: string } | null>(null)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Get legal moves for player
  const playerLegalMoves = gameState.phase === 'play' 
    ? legalMoves(gameState, 'south')
    : []
  
  // Handle card click
  const handleCardClick = useCallback((card: Card) => {
    if (gameState.phase !== 'play') return
    if (gameState.currentPlayer !== 'south') return
    
    // Check if card is legal
    const isLegal = playerLegalMoves.some(
      c => c.rank === card.rank && c.suit === card.suit
    )
    
    if (!isLegal) {
      setError('That is not a legal move!')
      setTimeout(() => setError(null), 2000)
      return
    }
    
    setError(null)
    setHint(null)
    
    // Play the card
    const newState = applyMove(gameState, { playerId: 'south', card })
    setGameState(newState)
  }, [gameState, playerLegalMoves])
  
  // Handle bot moves
  useEffect(() => {
    if (gameState.phase === 'play' && gameState.currentPlayer !== 'south') {
      const bot = bots[gameState.currentPlayer]
      if (bot) {
        const move = bot.chooseMove(gameState)
        
        // Delay for visual effect
        const timeout = setTimeout(() => {
          const newState = applyMove(gameState, { playerId: gameState.currentPlayer, card: move.card })
          setGameState(newState)
        }, 800)
        
        return () => clearTimeout(timeout)
      }
    }
  }, [gameState.phase, gameState.currentPlayer, bots])
  
  // Handle bidding for bots
  useEffect(() => {
    if (gameState.phase === 'bidding' && gameState.currentPlayer !== 'south') {
      const bot = bots[gameState.currentPlayer]
      if (bot) {
        const timeout = setTimeout(() => {
          const bid = bot.chooseBid(gameState)
          
          if (bid === 'pass') {
            const newState = applyPass(gameState, gameState.currentPlayer)
            setGameState(newState)
          } else {
            const newState = applyBid(gameState, bid)
            setGameState(newState)
          }
        }, 600)
        
        return () => clearTimeout(timeout)
      }
    }
    
    // Handle dealer choice for bots
    if (gameState.phase === 'dealerChoice' && gameState.currentPlayer !== 'south') {
      const bot = bots[gameState.currentPlayer]
      if (bot) {
        const timeout = setTimeout(() => {
          const suit = bot.chooseDealerChoice(gameState)
          const newState = applyDealerChoice(gameState, suit)
          setGameState(newState)
        }, 600)
        
        return () => clearTimeout(timeout)
      }
    }
  }, [gameState.phase, gameState.currentPlayer, bots])
  
  // Handle new game
  const handleNewGame = useCallback(() => {
    setGameState(createInitialState())
    setHint(null)
    setAnalysis(null)
    setError(null)
  }, [])
  
  // Handle hint
  const handleHint = useCallback(() => {
    if (gameState.phase !== 'play' || gameState.currentPlayer !== 'south') return
    
    const hintResult = getHint(gameState, 'south')
    setHint(hintResult)
  }, [gameState])
  
  // Handle analysis
  const handleAnalysis = useCallback(() => {
    const analysisResult = analyzeGame(gameState)
    const report = `Game Analysis
================
Overall Score: ${analysisResult.totalScore}/100
Team 1: ${analysisResult.team1Score}
Team 2: ${analysisResult.team2Score}
Mistakes: ${analysisResult.mistakes}
Blunders: ${analysisResult.blunders}`
    setAnalysis(report)
    setHint(null)
  }, [gameState])
  
  // Handle pass in bidding
  const handlePass = useCallback(() => {
    if (gameState.phase !== 'bidding') return
    if (gameState.currentPlayer !== 'south') return
    
    setError(null)
    setHint(null)
    
    const newState = applyPass(gameState, 'south')
    setGameState(newState)
  }, [gameState])
  
  // Handle dealer choice (when everyone passes)
  const handleDealerChoice = useCallback((suit: Suit) => {
    if (gameState.phase !== 'dealerChoice') return
    if (gameState.currentPlayer !== 'south') return
    
    setError(null)
    setHint(null)
    
    const newState = applyDealerChoice(gameState, suit)
    setGameState(newState)
  }, [gameState])
  
  // Handle bid
  const handleBid = useCallback((suit: Suit) => {
    if (gameState.phase !== 'bidding') return
    if (gameState.currentPlayer !== 'south') return
    
    setError(null)
    setHint(null)
    
    const bid: TrumpCall = { suit, playerId: 'south', level: gameState.currentBid?.level || 1 }
    const newState = applyBid(gameState, bid)
    setGameState(newState)
  }, [gameState])
  
  // Get current trick cards mapped to positions
  const trickCards: Record<PlayerId, Card | null> = {
    north: null,
    east: null,
    south: null,
    west: null
  }
  
  for (const { playerId, card } of gameState.currentTrick.cards) {
    trickCards[playerId] = card
  }
  
  // Get last trick winner cards
  const lastTrick = gameState.tricks[gameState.tricks.length - 1]
  
  // Determine phase message
  const getPhaseMessage = () => {
    switch (gameState.phase) {
      case 'deal':
        return 'Dealing cards...'
      case 'bidding':
        if (gameState.talon && gameState.talon.length > 0) {
          return gameState.currentPlayer === 'south' ? 'Your turn - choose trump and take talon!' : `${gameState.players[gameState.currentPlayer].name}'s turn to choose trump`
        }
        return gameState.currentPlayer === 'south' ? 'Your turn to bid' : `${gameState.players[gameState.currentPlayer].name}'s turn to bid`
      case 'dealerChoice':
        return gameState.currentPlayer === 'south' ? 'Everyone passed - choose trump (no talon)' : `${gameState.players[gameState.currentPlayer].name} must choose trump`
      case 'play':
        return gameState.currentPlayer === 'south' ? 'Your turn to play' : `${gameState.players[gameState.currentPlayer].name}'s turn to play`
      case 'scoring':
        return 'Hand complete! Calculating scores...'
      case 'gameOver':
        return 'Game Over!'
      default:
        return ''
    }
  }
  
  return (
    <div className="app">
      <header className="header">
        <h1>♠️ BelaLearn - Bela (Belote)</h1>
        <div className="header-controls">
          <button className="btn btn-primary" onClick={handleNewGame}>New Game</button>
        </div>
      </header>
      
      <ScoreBoard
        handScores={gameState.handScores}
        matchScores={gameState.matchScores}
        trump={gameState.trump}
        declarer={gameState.declarer}
      />
      
      <div className="game-table">
        {/* North player */}
        <PlayerSeat
          position="north"
          name={gameState.players.north.name}
          team={gameState.players.north.team}
          cardCount={gameState.players.north.hand.length}
          isCurrentTurn={gameState.currentPlayer === 'north'}
          isDeclarer={gameState.declarer === 'north'}
        />
        
        <div className="table-row top-row">
          {/* Talon - hidden cards */}
          {gameState.talon && gameState.talon.length > 0 && (
            <div className="talon">
              <div className="talon-label">Talon ({gameState.talon.length})</div>
              <div className="talon-cards">
                {gameState.talon.map((card, i) => (
                  <CardView key={i} card={card} small hidden={gameState.phase !== 'play' && gameState.phase !== 'dealerChoice'} />
                ))}
              </div>
            </div>
          )}
          
          {/* West player */}
          <PlayerSeat
            position="west"
            name={gameState.players.west.name}
            team={gameState.players.west.team}
            cardCount={gameState.players.west.hand.length}
            isCurrentTurn={gameState.currentPlayer === 'west'}
            isDeclarer={gameState.declarer === 'west'}
          />
          
          {/* Center - Trick display */}
          <div className="trick-area">
            <div className="trick-display">
              <div className="trick-card north">{trickCards.north && <CardView card={trickCards.north} small />}</div>
              <div className="trick-row">
                <div className="trick-card west">{trickCards.west && <CardView card={trickCards.west} small />}</div>
                <div className="trick-center">
                  {gameState.trump && <div className="trump-icon">{SUIT_SYMBOLS[gameState.trump]}</div>}
                </div>
                <div className="trick-card east">{trickCards.east && <CardView card={trickCards.east} small />}</div>
              </div>
              <div className="trick-card south">{trickCards.south && <CardView card={trickCards.south} small />}</div>
            </div>
            
            <div className="phase-message">{getPhaseMessage()}</div>
            
            {error && <div className="error-message">{error}</div>}
          </div>
          
          {/* East player */}
          <PlayerSeat
            position="east"
            name={gameState.players.east.name}
            team={gameState.players.east.team}
            cardCount={gameState.players.east.hand.length}
            isCurrentTurn={gameState.currentPlayer === 'east'}
            isDeclarer={gameState.declarer === 'east'}
          />
        </div>
        
        {/* South player - Human player */}
        <div className="player-area">
          <PlayerSeat
            position="south"
            name={gameState.players.south.name}
            team={gameState.players.south.team}
            cardCount={gameState.players.south.hand.length}
            isCurrentTurn={gameState.currentPlayer === 'south'}
            isDeclarer={gameState.declarer === 'south'}
          />
          
          <div className="hand">
            {gameState.players.south.hand.map((card, index) => {
              const isLegal = playerLegalMoves.some(c => c.rank === card.rank && c.suit === card.suit)
              return (
                <CardView
                  key={`${card.suit}-${card.rank}-${index}`}
                  card={card}
                  onClick={() => handleCardClick(card)}
                  playable={isLegal && gameState.currentPlayer === 'south'}
                />
              )
            })}
          </div>
        </div>
      </div>
      
      <div className="action-bar">
        {gameState.phase === 'bidding' && gameState.currentPlayer === 'south' && (
          <>
            <div className="bid-buttons">
              {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                <button
                  key={suit}
                  className={`btn btn-bid ${suit}`}
                  onClick={() => handleBid(suit as Suit)}
                >
                  {SUIT_SYMBOLS[suit as Suit]} {suit}
                </button>
              ))}
            </div>
            <button className="btn btn-pass" onClick={handlePass}>Pass</button>
          </>
        )}
        
        {gameState.phase === 'dealerChoice' && gameState.currentPlayer === 'south' && (
          <>
            <div className="bid-buttons">
              <span style={{color: '#ffd700', marginRight: '10px'}}>Choose Trump (no talon):</span>
              {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                <button
                  key={suit}
                  className={`btn btn-bid ${suit}`}
                  onClick={() => handleDealerChoice(suit as Suit)}
                >
                  {SUIT_SYMBOLS[suit as Suit]} {suit}
                </button>
              ))}
            </div>
          </>
        )}
        
        {gameState.phase === 'play' && gameState.currentPlayer === 'south' && (
          <button className="btn btn-hint" onClick={handleHint}>💡 Hint</button>
        )}
        
        {gameState.phase === 'scoring' && (
          <button className="btn btn-analysis" onClick={handleAnalysis}>📊 Analysis</button>
        )}
        
        <button className="btn btn-secondary" onClick={handleNewGame}>New Game</button>
      </div>
      
      {(hint || analysis) && (
        <HintPanel
          hint={hint}
          analysis={analysis}
          onClose={() => { setHint(null); setAnalysis(null) }}
        />
      )}
    </div>
  )
}

export default App
