import {
  GameState,
  PlayerId,
  Card,
  TrumpCall,
  DecisionGrade,
  GradedDecision,
  GameAnalysis,
  getPlayerTeam,
  PLAYER_ORDER,
  RANK_ORDER,
  getRankIndex
} from '../engine/types'
import { legalMoves, evaluateTrick } from '../engine/rules'

// Grade a single decision
export function gradeDecision(
  decision: {
    playerId: PlayerId
    move: { card?: Card; call?: TrumpCall }
    legalMoves: Card[]
  },
  optimalMove?: Card
): { grade: DecisionGrade; explanation: string } {
  const { playerId, move, legalMoves: legal } = decision
  
  // If there's no optimal move defined, use heuristics
  if (!optimalMove) {
    optimalMove = determineOptimalMove(decision)
  }
  
  // Grade the move
  if (!move.card && !move.call) {
    return { grade: 'mistake', explanation: 'Player passed when they could have bid/called.' }
  }
  
  if (move.card) {
    const cardStr = `${move.card.rank}-${move.card.suit}`
    const optimalStr = optimalMove ? `${optimalMove.rank}-${optimalMove.suit}` : ''
    
    if (cardStr === optimalStr) {
      return { grade: 'best', explanation: 'This is the optimal move!' }
    }
    
    // Check how close to optimal
    const decisionRank = getRankIndex(move.card.rank)
    const optimalRank = optimalMove ? getRankIndex(optimalMove.rank) : -1
    
    const isSameSuit = move.card.suit === optimalMove?.suit
    
    if (isSameSuit && decisionRank >= optimalRank - 1) {
      return { grade: 'ok', explanation: 'Good move, though not the best choice.' }
    }
    
    if (isSameSuit || move.card.suit === legal[0]?.suit) {
      return { grade: 'mistake', explanation: 'This move could be better.' }
    }
    
    return { grade: 'blunder', explanation: 'This is a poor choice in this situation.' }
  }
  
  return { grade: 'ok', explanation: 'Acceptable decision.' }
}

// Determine optimal move using simple heuristics
function determineOptimalMove(decision: {
  playerId: PlayerId
  legalMoves: Card[]
}): Card | undefined {
  const { legalMoves: legal } = decision
  
  if (legal.length === 0) return undefined
  
  // Simple: prefer playing high cards that can win
  // This is a simplified version - real optimal would need game simulation
  
  // Return highest legal card that could potentially win
  return legal[legal.length - 1]
}

// Analyze entire game
export function analyzeGame(state: GameState): GameAnalysis {
  const decisions: GradedDecision[] = []
  
  // Analyze bidding phase
  for (const event of state.events) {
    if (event.type === 'bid' && event.playerId) {
      const bid = event.data as TrumpCall
      
      // Simple grading: if player bid, give OK grade
      decisions.push({
        playerId: event.playerId,
        move: { type: 'call', playerId: event.playerId, call: bid },
        legalMoves: [],
        grade: 'ok',
        explanation: 'Player chose to bid.',
        decisionType: 'bid'
      })
    }
  }
  
  // Analyze card plays
  const playerMoves: Record<PlayerId, Card[]> = {
    north: [],
    east: [],
    south: [],
    west: []
  }
  
  for (const event of state.events) {
    if (event.type === 'play_card' && event.playerId && event.data) {
      const card = event.data as Card
      playerMoves[event.playerId].push(card)
    }
  }
  
  // Grade each move
  // This is simplified - in a real implementation we'd need to track the state at each decision point
  
  const mistakes = decisions.filter(d => d.grade === 'mistake').length
  const blunders = decisions.filter(d => d.grade === 'blunder').length
  
  // Calculate game score (0-100)
  const totalScore = computeGameScore(state)
  
  return {
    decisions,
    totalScore,
    team1Score: state.matchScores.team1,
    team2Score: state.matchScores.team2,
    contractMade: true, // Simplified
    mistakes,
    blunders
  }
}

// Compute game score (0-100)
export function computeGameScore(state: GameState): number {
  // Base score from match points
  const team1MatchScore = state.matchScores.team1
  const team2MatchScore = state.matchScores.team2
  
  // If no game completed, return 0
  if (team1MatchScore === 0 && team2MatchScore === 0) {
    return 0
  }
  
  // Calculate relative performance
  const total = team1MatchScore + team2MatchScore
  if (total === 0) return 50 // Neutral if no scores
  
  const team1Percent = (team1MatchScore / total) * 100
  
  // Base score from win percentage
  let score = team1Percent
  
  // Adjust for hand score efficiency
  const handScore = state.handScores.team1
  const maxHandScore = 256 // Max possible in a hand
  const efficiency = handScore / maxHandScore
  
  score = (score + efficiency * 20) / 2
  
  // Ensure 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)))
}

// Get hint for player
export function getHint(state: GameState, playerId: PlayerId): {
  card: Card
  explanation: string
} {
  const legal = legalMoves(state, playerId)
  
  if (legal.length === 0) {
    throw new Error('No legal moves available')
  }
  
  // Simple hint logic: find best move based on heuristics
  const trick = state.currentTrick
  
  if (trick.cards.length === 0) {
    // Leading - suggest low trump or low card
    const trumps = legal.filter(c => c.suit === state.trump)
    if (trumps.length > 0) {
      const lowTrump = trumps.sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank))[0]
      return {
        card: lowTrump,
        explanation: 'Consider leading with your lowest trump to control the game.'
      }
    }
    
    const lowCard = legal.sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank))[0]
    return {
      card: lowCard,
      explanation: 'Lead with your lowest card from your longest suit.'
    }
  }
  
  // Following - can we win?
  const leadCard = trick.cards[0].card
  const isTrumpInTrick = trick.cards.some(c => c.card.suit === state.trump)
  
  const winningCards = legal.filter(card => {
    if (card.suit === state.trump && !isTrumpInTrick) return true
    if (card.suit !== state.trump && isTrumpInTrick) return false
    if (card.suit === leadCard.suit && getRankIndex(card.rank) > getRankIndex(leadCard.rank)) {
      // Check if any other card in trick is higher
      const higherCards = trick.cards
        .filter(c => c.card.suit === card.suit)
        .filter(c => getRankIndex(c.card.rank) > getRankIndex(card.rank))
      return higherCards.length === 0
    }
    return false
  })
  
  if (winningCards.length > 0) {
    const best = winningCards.sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank))[0]
    return {
      card: best,
      explanation: `Play ${best.rank} of ${best.suit} to win the trick!`
    }
  }
  
  // Can't win - suggest discarding
  const lowCard = legal.sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank))[0]
  return {
    card: lowCard,
    explanation: "You can't win this trick. Play your lowest card to save high cards for later."
  }
}

// Generate text report
export function generateReport(analysis: GameAnalysis): string {
  let report = '=== Game Analysis ===\n\n'
  
  report += `Overall Score: ${analysis.totalScore}/100\n`
  report += `Team 1 Score: ${analysis.team1Score}\n`
  report += `Team 2 Score: ${analysis.team2Score}\n\n`
  
  report += `Mistakes: ${analysis.mistakes}\n`
  report += `Blunders: ${analysis.blunders}\n\n`
  
  if (analysis.decisions.length > 0) {
    report += '=== Decision Summary ===\n'
    for (const decision of analysis.decisions) {
      report += `\n${decision.playerId}: ${decision.grade.toUpperCase()} - ${decision.explanation}\n`
    }
  }
  
  return report
}
