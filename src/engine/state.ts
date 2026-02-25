// Game state management - re-exports from rules
// Most functionality is directly in rules.ts

export { createInitialState, applyMove, applyBid, applyPass, applyDealerChoice, endOfHandScoring, isGameOver, legalMoves } from './rules'

export type { GameState, PlayerId, Card, TrumpCall, Phase, TeamId, Suit } from './types'
