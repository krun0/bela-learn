// Bela Card Types

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'
export type TrumpCall = {
  suit: Suit
  playerId: PlayerId
  level: number
}

export interface Card {
  suit: Suit
  rank: Rank
}

export type PlayerId = 'north' | 'east' | 'south' | 'west'
export type TeamId = 'team1' | 'team2'

export interface Player {
  id: PlayerId
  name: string
  team: TeamId
  hand: Card[]
  isDeclarer: boolean
}

export type Phase = 'deal' | 'bidding' | 'dealerChoice' | 'play' | 'scoring' | 'gameOver'

export interface Trick {
  cards: { playerId: PlayerId; card: Card }[]
  winner: PlayerId | null
  points: number
}

export interface Declaration {
  type: 'bela' | 'tierce' | 'quarte' | 'quint' | 'belot'
  playerId: PlayerId
  cards: Card[]
  points: number
}

export interface Move {
  type: 'play' | 'pass' | 'call' | 'declare'
  playerId: PlayerId
  card?: Card
  call?: TrumpCall
  declaration?: Declaration
}

export interface GameEvent {
  id: string
  type: string
  timestamp: number
  playerId?: PlayerId
  data: unknown
}

export interface GameConfig {
  mustFollowSuit: boolean
  mustTrumpWhenVoid: boolean
  overtrumpRequired: boolean
  declarationsEnabled: boolean
  lastTrickBonus: boolean
  matchTargetScore: number
}

export interface GameState {
  phase: Phase
  deck: Card[]
  players: Record<PlayerId, Player>
  currentPlayer: PlayerId
  declarer: PlayerId | null
  trump: Suit | null
  currentTrick: Trick
  tricks: Trick[]
  currentBid: TrumpCall | null
  bids: TrumpCall[]
  declarations: Declaration[]
  handScores: Record<TeamId, number>
  matchScores: Record<TeamId, number>
  events: GameEvent[]
  config: GameConfig
  dealer: PlayerId
  talon: Card[]  // The 2 hidden cards (talon)
}

export interface Decision {
  playerId: PlayerId
  move: Move
  legalMoves: Card[]
  decisionType: 'bid' | 'play'
}

export type DecisionGrade = 'best' | 'ok' | 'mistake' | 'blunder'

export interface GradedDecision extends Decision {
  grade: DecisionGrade
  explanation: string
  optimalMove?: Card
}

export interface GameAnalysis {
  decisions: GradedDecision[]
  totalScore: number
  team1Score: number
  team2Score: number
  contractMade: boolean
  mistakes: number
  blunders: number
}

// Scoring constants
export const CARD_VALUES: Record<Rank, number> = {
  '7': 0,
  '8': 0,
  '9': 0,
  '10': 10,
  'J': 2,
  'Q': 3,
  'K': 4,
  'A': 11
}

export const TRUMP_CARD_VALUES: Record<Rank, number> = {
  '7': 0,
  '8': 0,
  '9': 0,
  '10': 10,
  'J': 2,
  'Q': 3,
  'K': 4,
  'A': 11
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
}

export const RANK_ORDER: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']

export const PLAYER_ORDER: PlayerId[] = ['north', 'east', 'south', 'west']

export function getRankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank)
}

export const TEAM_PLAYERS: Record<TeamId, PlayerId[]> = {
  team1: ['north', 'south'],
  team2: ['east', 'west']
}

export function getPlayerTeam(playerId: PlayerId): TeamId {
  return playerId === 'north' || playerId === 'south' ? 'team1' : 'team2'
}

export function getNextPlayer(playerId: PlayerId): PlayerId {
  const idx = PLAYER_ORDER.indexOf(playerId)
  return PLAYER_ORDER[(idx + 1) % 4]
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit[0].toUpperCase()}`
}

export function stringToCard(str: string): Card {
  const rank = str.slice(0, -1) as Rank
  const suit = str.slice(-1).toLowerCase() as Suit
  return { rank, suit }
}
