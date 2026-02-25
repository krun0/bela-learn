import {
  GameState,
  PlayerId,
  Card,
  TrumpCall,
  RANK_ORDER,
  getRankIndex,
  SUIT_SYMBOLS,
  getPlayerTeam,
  getNextPlayer,
  Suit
} from '../engine/types'
import { legalMoves } from '../engine/rules'

export interface BotMove {
  card: Card
  explanation: string
}

// Level 1 Bot: Beginner/Teaching bot with rule-based heuristics
export class BotLevel1 {
  private playerId: PlayerId
  private name: string

  constructor(playerId: PlayerId, name: string) {
    this.playerId = playerId
    this.name = name
  }

  // Choose a bid
  chooseBid(state: GameState): TrumpCall | 'pass' {
    const hand = state.players[this.playerId].hand
    
    // Count trump cards
    // First, need to determine what we can bid
    // Simple heuristic: bid if we have 4+ trump cards
    // or if we have strong suit (A, K, Q)
    
    const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades']
    let bestSuit: Card['suit'] | null = null
    let maxStrength = 0
    
    for (const suit of suits) {
      const suitCards = hand.filter(c => c.suit === suit)
      let strength = 0
      for (const card of suitCards) {
        const rankIdx = getRankIndex(card.rank)
        strength += rankIdx // Higher cards = higher strength
      }
      
      if (strength > maxStrength) {
        maxStrength = strength
        bestSuit = suit
      }
    }
    
    // Bid if we have at least 3 cards in a suit with good strength
    const bestSuitCards = bestSuit ? hand.filter(c => c.suit === bestSuit) : []
    
    if (bestSuit && bestSuitCards.length >= 3 && maxStrength >= 10) {
      return { suit: bestSuit, playerId: this.playerId, level: 1 }
    }
    
    return 'pass'
  }

  // Choose trump when dealer (everyone passed)
  chooseDealerChoice(state: GameState): Suit {
    const hand = state.players[this.playerId].hand
    
    // Find best suit in hand
    const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades']
    let bestSuit: Card['suit'] = 'hearts'
    let maxStrength = 0
    
    for (const suit of suits) {
      const suitCards = hand.filter(c => c.suit === suit)
      let strength = 0
      for (const card of suitCards) {
        const rankIdx = getRankIndex(card.rank)
        strength += rankIdx
      }
      
      if (strength > maxStrength) {
        maxStrength = strength
        bestSuit = suit
      }
    }
    
    return bestSuit
  }

  // Choose a card to play
  chooseMove(state: GameState): BotMove {
    const hand = state.players[this.playerId].hand
    const legal = legalMoves(state, this.playerId)
    
    if (legal.length === 0) {
      throw new Error('No legal moves!')
    }
    
    // Simple strategy
    const trick = state.currentTrick
    
    // If leading (first card)
    if (trick.cards.length === 0) {
      return this.chooseLead(hand, legal, state.trump)
    }
    
    // If following
    const leadCard = trick.cards[0].card
    const isTrumpInTrick = trick.cards.some(c => c.card.suit === state.trump)
    
    // Get cards that can win
    const canWin = legal.filter(card => this.cardCanWin(card, leadCard, state.trump!, isTrumpInTrick, trick))
    
    if (canWin.length > 0) {
      // Play lowest winning card
      const sorted = [...canWin].sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank))
      return {
        card: sorted[0],
        explanation: `Playing ${this.cardName(sorted[0])} to win the trick.`
      }
    }
    
    // Can't win - play lowest card
    const sorted = [...legal].sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank))
    
    // Play low trump if opponent may have trump
    const trumpCards = sorted.filter(c => c.suit === state.trump)
    if (trumpCards.length > 0 && isTrumpInTrick) {
      return {
        card: trumpCards[0],
        explanation: `Discarding ${this.cardName(trumpCards[0])} since you can't win.`
      }
    }
    
    // Otherwise play lowest non-trump
    const nonTrump = sorted.filter(c => c.suit !== state.trump)
    if (nonTrump.length > 0) {
      return {
        card: nonTrump[0],
        explanation: `Discarding ${this.cardName(nonTrump[0])} - lowest card.`
      }
    }
    
    return {
      card: sorted[0],
      explanation: `Playing ${this.cardName(sorted[0])}.`
    }
  }

  private chooseLead(hand: Card[], legal: Card[], trump: Suit | null): BotMove {
    if (!trump) return { card: legal[0], explanation: 'Leading.' }
    
    // Lead with lowest trump if possible
    const trumps = legal.filter(c => c.suit === trump)
    if (trumps.length > 0) {
      const sorted = [...trumps].sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank))
      return {
        card: sorted[0],
        explanation: `Leading with ${this.cardName(sorted[0])} - lowest trump.`
      }
    }
    
    // Lead with lowest card of longest suit
    const suitCounts: Record<string, number> = {}
    for (const card of legal) {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1
    }
    
    let longestSuit: Suit = legal[0].suit
    let maxCount = 0
    for (const [suit, count] of Object.entries(suitCounts)) {
      if (count > maxCount) {
        maxCount = count
        longestSuit = suit as Suit
      }
    }
    
    const suitCards = legal.filter(c => c.suit === longestSuit)
    const sorted = [...suitCards].sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank))
    
    return {
      card: sorted[0],
      explanation: `Leading with ${this.cardName(sorted[0])} from your longest suit.`
    }
  }

  private cardCanWin(
    card: Card,
    leadCard: Card,
    trump: string,
    isTrumpInTrick: boolean,
    trick: { cards: { playerId: PlayerId; card: Card }[] }
  ): boolean {
    // If we play trump and there's no trump yet, we win
    if (card.suit === trump && !isTrumpInTrick) {
      return true
    }
    
    // If we play non-trump and there's trump, we can't win
    if (card.suit !== trump && isTrumpInTrick) {
      return false
    }
    
    // Same suit as lead
    if (card.suit === leadCard.suit) {
      // Check if higher than all other cards in trick
      const otherCards = trick.cards.map(c => c.card).filter(c => c.suit === card.suit)
      for (const other of otherCards) {
        if (getRankIndex(card.rank) <= getRankIndex(other.rank)) {
          return false
        }
      }
      return true
    }
    
    return false
  }

  private cardName(card: Card): string {
    const rankNames: Record<string, string> = {
      '7': 'Seven',
      '8': 'Eight',
      '9': 'Nine',
      '10': 'Ten',
      'J': 'Jack',
      'Q': 'Queen',
      'K': 'King',
      'A': 'Ace'
    }
    return `${rankNames[card.rank]} of ${card.suit}`
  }

  getPlayerId(): PlayerId {
    return this.playerId
  }

  getName(): string {
    return this.name
  }
}

// Level 2 Bot: Stronger bot with better heuristics
export class BotLevel2 {
  private playerId: PlayerId
  private name: string

  constructor(playerId: PlayerId, name: string) {
    this.playerId = playerId
    this.name = name
  }

  // Choose a bid - more aggressive than Level 1
  chooseBid(state: GameState): TrumpCall | 'pass' {
    const hand = state.players[this.playerId].hand
    
    // Evaluate hand strength
    const strength = this.evaluateHand(hand, state.trump)
    
    // More aggressive bidding
    if (strength >= 20) {
      // Find best suit
      const bestSuit = this.findBestSuit(hand)
      if (bestSuit) {
        return { suit: bestSuit, playerId: this.playerId, level: 1 }
      }
    }
    
    return 'pass'
  }

  // Choose trump when dealer (everyone passed)
  chooseDealerChoice(state: GameState): Suit {
    const hand = state.players[this.playerId].hand
    return this.findBestSuit(hand) || 'hearts'
  }

  // Choose a card to play - uses simulation
  chooseMove(state: GameState): BotMove {
    const legal = legalMoves(state, this.playerId)
    
    if (legal.length === 0) {
      throw new Error('No legal moves!')
    }
    
    // Simple Monte Carlo approximation: evaluate each move
    let bestMove = legal[0]
    let bestScore = -Infinity
    let bestExplanation = ''
    
    for (const card of legal) {
      const score = this.evaluateMove(state, card)
      if (score > bestScore) {
        bestScore = score
        bestMove = card
        bestExplanation = this.getExplanation(state, card)
      }
    }
    
    return {
      card: bestMove,
      explanation: bestExplanation
    }
  }

  private evaluateHand(hand: Card[], currentTrump: string | null): number {
    let score = 0
    
    const trump = currentTrump || this.findBestSuit(hand)
    
    // Count high cards
    const rankValues: Record<string, number> = {
      'A': 8,
      'K': 7,
      'Q': 6,
      'J': 5,
      '10': 4,
      '9': 2,
      '8': 1,
      '7': 0
    }
    
    for (const card of hand) {
      const isTrump = card.suit === trump
      const value = rankValues[card.rank] || 0
      score += isTrump ? value * 1.5 : value
    }
    
    // Bonus for length in suit
    const suitCounts: Record<string, number> = {}
    for (const card of hand) {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1
    }
    
    for (const count of Object.values(suitCounts)) {
      if (count >= 4) {
        score += (count - 3) * 3
      }
    }
    
    return score
  }

  private findBestSuit(hand: Card[]): Card['suit'] | null {
    const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades']
    let bestSuit: Card['suit'] | null = null
    let bestScore = -1
    
    for (const suit of suits) {
      const suitCards = hand.filter(c => c.suit === suit)
      const strength = suitCards.reduce((sum, c) => {
        const rankValues: Record<string, number> = { 'A': 8, 'K': 7, 'Q': 6, 'J': 5, '10': 4 }
        return sum + (rankValues[c.rank] || 0)
      }, 0)
      
      if (strength > bestScore && suitCards.length >= 3) {
        bestScore = strength
        bestSuit = suit
      }
    }
    
    return bestSuit
  }

  private evaluateMove(state: GameState, card: Card): number {
    let score = 0
    
    const trick = state.currentTrick
    
    // If leading
    if (trick.cards.length === 0) {
      // Prefer leading with trumps
      if (card.suit === state.trump) {
        score += 10
      }
      // Prefer leading with sequences
      score += this.getSequenceBonus(state.players[this.playerId].hand, card)
      // Prefer leading with low cards
      score -= getRankIndex(card.rank) * 2
    } else {
      // Following
      const leadCard = trick.cards[0].card
      const isTrumpInTrick = trick.cards.some(c => c.card.suit === state.trump)
      
      // Can win?
      if (this.canWin(card, leadCard, state.trump!, isTrumpInTrick, trick)) {
        score += 20
        // Prefer winning with lower cards
        score -= getRankIndex(card.rank) * 3
      } else {
        // Can't win - prefer playing low
        score -= getRankIndex(card.rank)
        
        // If opponent may have trumps, play high trump to drain
        if (!isTrumpInTrick && card.suit === state.trump) {
          score += 5
        }
      }
    }
    
    // Consider remaining cards in hand
    const hand = state.players[this.playerId].hand
    const remainingSuits = this.countRemainingSuits(hand, card)
    
    // Keep suit length
    if (remainingSuits[card.suit] <= 1 && card.suit !== state.trump) {
      score -= 5 // Don't unguard
    }
    
    return score
  }

  private getSequenceBonus(hand: Card[], card: Card): number {
    const suitCards = hand.filter(c => c.suit === card.suit)
    const sorted = [...suitCards].sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank))
    
    const cardIdx = sorted.findIndex(c => c.rank === card.rank)
    let bonus = 0
    
    // Check for sequence
    if (cardIdx > 0 && getRankIndex(sorted[cardIdx - 1].rank) === getRankIndex(card.rank) - 1) {
      bonus += 5
    }
    if (cardIdx < sorted.length - 1 && getRankIndex(sorted[cardIdx + 1].rank) === getRankIndex(card.rank) + 1) {
      bonus += 5
    }
    
    return bonus
  }

  private canWin(
    card: Card,
    leadCard: Card,
    trump: string,
    isTrumpInTrick: boolean,
    trick: { cards: { playerId: PlayerId; card: Card }[] }
  ): boolean {
    if (card.suit === trump && !isTrumpInTrick) {
      return true
    }
    
    if (card.suit !== trump && isTrumpInTrick) {
      return false
    }
    
    if (card.suit === leadCard.suit) {
      const otherCards = trick.cards.map(c => c.card).filter(c => c.suit === card.suit)
      for (const other of otherCards) {
        if (getRankIndex(card.rank) <= getRankIndex(other.rank)) {
          return false
        }
      }
      return true
    }
    
    return false
  }

  private countRemainingSuits(hand: Card[], playedCard: Card): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const card of hand) {
      if (card !== playedCard) {
        counts[card.suit] = (counts[card.suit] || 0) + 1
      }
    }
    return counts
  }

  private getExplanation(state: GameState, card: Card): string {
    const trick = state.currentTrick
    
    if (trick.cards.length === 0) {
      return `Leading with ${this.cardName(card)}.`
    }
    
    const leadCard = trick.cards[0].card
    const isTrumpInTrick = trick.cards.some(c => c.card.suit === state.trump)
    
    if (this.canWin(card, leadCard, state.trump!, isTrumpInTrick, trick)) {
      return `Playing ${this.cardName(card)} to win the trick!`
    }
    
    return `Discarding ${this.cardName(card)}.`
  }

  private cardName(card: Card): string {
    const rankNames: Record<string, string> = {
      '7': 'Seven',
      '8': 'Eight',
      '9': 'Nine',
      '10': 'Ten',
      'J': 'Jack',
      'Q': 'Queen',
      'K': 'King',
      'A': 'Ace'
    }
    return `${rankNames[card.rank]} of ${card.suit}`
  }

  getPlayerId(): PlayerId {
    return this.playerId
  }

  getName(): string {
    return this.name
  }
}

// Bot factory
export type BotLevel = BotLevel1 | BotLevel2

export function createBot(playerId: PlayerId, level: 1 | 2, name?: string): BotLevel {
  const botName = name || (level === 1 ? 'Bot' : 'Advanced Bot')
  
  if (level === 1) {
    return new BotLevel1(playerId, botName)
  }
  return new BotLevel2(playerId, botName)
}
