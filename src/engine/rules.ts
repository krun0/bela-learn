import {
  Card,
  PlayerId,
  Suit,
  Rank,
  TrumpCall,
  GameState,
  GameEvent,
  Trick,
  Declaration,
  Phase,
  TeamId,
  PLAYER_ORDER,
  RANK_ORDER,
  CARD_VALUES,
  SUIT_SYMBOLS,
  GameConfig,
  getPlayerTeam,
  getNextPlayer,
  cardToString
} from './types'

// Default configuration
const DEFAULT_CONFIG: GameConfig = {
  mustFollowSuit: true,
  mustTrumpWhenVoid: true,
  overtrumpRequired: false,
  declarationsEnabled: true,
  lastTrickBonus: true,
  matchTargetScore: 1001
}

// Generate a 32-card Bela deck
export function generateDeck(): Card[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  const ranks: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  
  const deck: Card[] = []
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank })
    }
  }
  
  // Shuffle the deck (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }
  
  return deck
}

// Deal cards to players
function dealCards(deck: Card[]): Record<PlayerId, Card[]> {
  const players: Record<PlayerId, Card[]> = {
    north: [],
    east: [],
    south: [],
    west: []
  }
  
  // Deal 8 cards to each player (4 at a time)
  for (let round = 0; round < 2; round++) {
    for (const player of PLAYER_ORDER) {
      for (let i = 0; i < 4; i++) {
        if (deck.length > 0) {
          players[player].push(deck.pop()!)
        }
      }
    }
  }
  
  // Sort each player's hand
  for (const player of PLAYER_ORDER) {
    players[player].sort((a, b) => {
      if (a.suit !== b.suit) {
        return a.suit.localeCompare(b.suit)
      }
      return RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank)
    })
  }
  
  return players
}

// Create initial game state
export function createInitialState(config: Partial<GameConfig> = {}): GameState {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const deck = generateDeck()
  const hands = dealCards([...deck]) // Copy deck before dealing
  
  // Remove dealt cards from deck - remaining are talon (last 2)
  const remainingDeck: Card[] = []
  const dealtCards = new Set<string>()
  for (const player of PLAYER_ORDER) {
    for (const card of hands[player]) {
      dealtCards.add(cardToString(card))
    }
  }
  for (const card of deck) {
    if (!dealtCards.has(cardToString(card))) {
      remainingDeck.push(card)
    }
  }
  
  // Last 2 cards are talon (hidden)
  const talon = remainingDeck.slice(-2)
  
  const dealer: PlayerId = 'south'
  
  return {
    phase: 'bidding',
    deck: remainingDeck.slice(0, -2), // Deck without talon
    players: {
      north: { id: 'north', name: 'North', team: 'team1', hand: hands.north, isDeclarer: false },
      east: { id: 'east', name: 'East', team: 'team2', hand: hands.east, isDeclarer: false },
      south: { id: 'south', name: 'You', team: 'team1', hand: hands.south, isDeclarer: false },
      west: { id: 'west', name: 'West', team: 'team2', hand: hands.west, isDeclarer: false }
    },
    currentPlayer: getNextPlayer(dealer),
    declarer: null,
    trump: null,
    currentTrick: { cards: [], winner: null, points: 0 },
    tricks: [],
    currentBid: null,
    bids: [],
    declarations: [],
    handScores: { team1: 0, team2: 0 },
    matchScores: { team1: 0, team2: 0 },
    events: [],
    config: fullConfig,
    dealer,
    talon
  }
}

// Get rank index for comparison
function getRankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank)
}

// Check if a card is trump
function isTrump(card: Card, trump: Suit): boolean {
  return card.suit === trump
}

// Check if card beats another card in trick
export function cardBeats(
  card: Card,
  leadCard: Card,
  trump: Suit,
  isFirstTrump: boolean
): boolean {
  const cardIsTrump = isTrump(card, trump)
  const leadIsTrump = isTrump(leadCard, trump)
  
  // If no trump in game, compare suits
  if (!trump) {
    return card.suit === leadCard.suit && getRankIndex(card.rank) > getRankIndex(leadCard.rank)
  }
  
  // Trump beats non-trump
  if (cardIsTrump && !leadIsTrump) {
    return true
  }
  
  // Non-trump cannot beat trump (unless no trump played)
  if (!cardIsTrump && leadIsTrump) {
    return false
  }
  
  // Both trump - compare rank
  if (cardIsTrump && leadIsTrump) {
    // First trump played - any trump beats it
    if (isFirstTrump) {
      return true
    }
    // Compare trump ranks
    return getRankIndex(card.rank) > getRankIndex(leadCard.rank)
  }
  
  // Same suit as lead
  if (card.suit === leadCard.suit) {
    return getRankIndex(card.rank) > getRankIndex(leadCard.rank)
  }
  
  return false
}

// Get all cards of a suit from hand
function getCardsOfSuit(hand: Card[], suit: Suit): Card[] {
  return hand.filter(card => card.suit === suit)
}

// Get all trump cards from hand
function getTrumpCards(hand: Card[], trump: Suit): Card[] {
  return hand.filter(card => card.suit === trump)
}

// Get legal moves for a player
export function legalMoves(state: GameState, playerId: PlayerId): Card[] {
  const player = state.players[playerId]
  const hand = player.hand
  
  if (!state.trump) {
    // During bidding phase, can play any card
    return [...hand]
  }
  
  const currentTrick = state.currentTrick
  
  // If this is the first card in the trick, any card is legal
  if (currentTrick.cards.length === 0) {
    return [...hand]
  }
  
  const leadCard = currentTrick.cards[0].card
  const leadSuit = leadCard.suit
  
  // Get cards that follow the lead suit
  const cardsOfLeadSuit = getCardsOfSuit(hand, leadSuit)
  
  // Get trump cards
  const trumpCards = getTrumpCards(hand, state.trump)
  
  // Check if lead suit was trump
  const leadIsTrump = leadCard.suit === state.trump
  
  // If player has cards of lead suit, must play one
  if (cardsOfLeadSuit.length > 0) {
    return cardsOfLeadSuit
  }
  
  // No cards of lead suit
  // If trump in trick, must play trump if have one
  if (currentTrick.cards.some(c => c.card.suit === state.trump)) {
    if (trumpCards.length > 0) {
      if (state.config.overtrumpRequired) {
        // Must play higher trump if possible
        const highestTrumpLead = currentTrick.cards
          .filter(c => c.card.suit === state.trump)
          .sort((a, b) => getRankIndex(b.card.rank) - getRankIndex(a.card.rank))[0]
        
        if (highestTrumpLead) {
          const higherTrumps = trumpCards.filter(
            c => getRankIndex(c.rank) > getRankIndex(highestTrumpLead.card.rank)
          )
          if (higherTrumps.length > 0) {
            return higherTrumps
          }
        }
        return trumpCards
      }
      return trumpCards
    }
  }
  
  // Can play any card
  return [...hand]
}

// Apply a card play move
export function applyMove(state: GameState, move: { playerId: PlayerId; card: Card }): GameState {
  const newState = JSON.parse(JSON.stringify(state)) as GameState
  const player = newState.players[move.playerId]
  
  // Remove card from hand
  const cardIndex = player.hand.findIndex(
    c => c.suit === move.card.suit && c.rank === move.card.rank
  )
  
  if (cardIndex === -1) {
    throw new Error(`Card ${cardToString(move.card)} not in ${move.playerId}'s hand`)
  }
  
  player.hand.splice(cardIndex, 1)
  
  // Add card to current trick
  newState.currentTrick.cards.push({
    playerId: move.playerId,
    card: move.card
  })
  
  // Add event
  newState.events.push({
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'play_card',
    timestamp: Date.now(),
    playerId: move.playerId,
    data: move.card
  })
  
  // Check if trick is complete
  if (newState.currentTrick.cards.length === 4) {
    const winner = evaluateTrick(newState.currentTrick, newState.trump!)
    newState.currentTrick.winner = winner
    const points = scoreTrick(newState.currentTrick, newState.trump!)
    newState.currentTrick.points = points
    
    newState.tricks.push({ ...newState.currentTrick })
    
    // Add trick completion event
    newState.events.push({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'trick_complete',
      timestamp: Date.now(),
      data: { winner, points }
    })
    
    // Reset for next trick
    newState.currentTrick = { cards: [], winner: null, points: 0 }
    newState.currentPlayer = winner
  } else {
    // Next player
    newState.currentPlayer = getNextPlayer(move.playerId)
  }
  
  // Check if hand is over (all cards played)
  if (player.hand.length === 0 && newState.phase === 'play') {
    newState.phase = 'scoring'
    const scores = endOfHandScoring(newState)
    newState.handScores = scores.handScores
    newState.matchScores = scores.matchScores
    
    // Add scoring event
    newState.events.push({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'hand_complete',
      timestamp: Date.now(),
      data: scores
    })
  }
  
  return newState
}

// Evaluate trick winner
export function evaluateTrick(trick: Trick, trump: Suit): PlayerId {
  if (trick.cards.length === 0) {
    throw new Error('Empty trick')
  }
  
  if (trick.cards.length === 1) {
    return trick.cards[0].playerId
  }
  
  const leadCard = trick.cards[0].card
  let bestCard = leadCard
  let bestPlayer = trick.cards[0].playerId
  let isFirstTrump = leadCard.suit === trump
  
  for (let i = 1; i < trick.cards.length; i++) {
    const currentCard = trick.cards[i].card
    const currentPlayer = trick.cards[i].playerId
    
    if (cardBeats(currentCard, bestCard, trump, isFirstTrump)) {
      bestCard = currentCard
      bestPlayer = currentPlayer
      
      // Update first trump flag
      if (currentCard.suit === trump && !isFirstTrump) {
        isFirstTrump = true
      }
    }
  }
  
  return bestPlayer
}

// Score a trick
export function scoreTrick(trick: Trick, trump: Suit): number {
  let points = 0
  
  for (const { card } of trick.cards) {
    const isTrumpCard = card.suit === trump
    const values = isTrumpCard ? CARD_VALUES : CARD_VALUES
    points += values[card.rank]
  }
  
  return points
}

// Check for declarations (zvanja)
export function checkDeclarations(state: GameState, playerId: PlayerId): Declaration[] {
  if (!state.config.declarationsEnabled || !state.trump) {
    return []
  }
  
  const declarations: Declaration[] = []
  const player = state.players[playerId]
  const hand = player.hand
  
  // Check for Bela (K + Q of trump)
  const trumpCards = hand.filter(c => c.suit === state.trump)
  const hasK = trumpCards.some(c => c.rank === 'K')
  const hasQ = trumpCards.some(c => c.rank === 'Q')
  
  if (hasK && hasQ) {
    declarations.push({
      type: 'bela',
      playerId,
      cards: trumpCards.filter(c => c.rank === 'K' || c.rank === 'Q'),
      points: 20
    })
  }
  
  // Check for tierce, quarte, quint (consecutive cards in same suit)
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  
  for (const suit of suits) {
    const suitCards = hand
      .filter(c => c.suit === suit)
      .sort((a, b) => getRankIndex(a.rank) - getRankIndex(b.rank))
    
    for (let i = 0; i < suitCards.length; i++) {
      let consecutive = 1
      for (let j = i; j < suitCards.length - 1; j++) {
        const currentIdx = getRankIndex(suitCards[j].rank)
        const nextIdx = getRankIndex(suitCards[j + 1].rank)
        if (nextIdx === currentIdx + 1) {
          consecutive++
        } else {
          break
        }
      }
      
      if (consecutive >= 5) {
        declarations.push({
          type: 'quint',
          playerId,
          cards: suitCards.slice(i, i + 5),
          points: 100
        })
      } else if (consecutive >= 4) {
        declarations.push({
          type: 'quarte',
          playerId,
          cards: suitCards.slice(i, i + 4),
          points: 50
        })
      } else if (consecutive >= 3) {
        declarations.push({
          type: 'tierce',
          playerId,
          cards: suitCards.slice(i, i + 3),
          points: 20
        })
      }
    }
  }
  
  return declarations
}

// End of hand scoring
export function endOfHandScoring(state: GameState): {
  handScores: Record<TeamId, number>
  matchScores: Record<TeamId, number>
  contractBonus: number
} {
  if (!state.trump || !state.declarer) {
    return {
      handScores: state.handScores,
      matchScores: state.matchScores,
      contractBonus: 0
    }
  }
  
  // Calculate trick points
  let team1Points = 0
  let team2Points = 0
  
  for (const trick of state.tricks) {
    const winner = trick.winner!
    const team = getPlayerTeam(winner)
    
    if (team === 'team1') {
      team1Points += trick.points
    } else {
      team2Points += trick.points
    }
  }
  
  // Add last trick bonus
  if (state.config.lastTrickBonus) {
    const lastTrickWinner = state.tricks[state.tricks.length - 1].winner!
    if (getPlayerTeam(lastTrickWinner) === 'team1') {
      team1Points += 10
    } else {
      team2Points += 10
    }
  }
  
  // Add declaration points
  let team1Declarations = 0
  let team2Declarations = 0
  
  for (const decl of state.declarations) {
    const team = getPlayerTeam(decl.playerId)
    if (team === 'team1') {
      team1Declarations += decl.points
    } else {
      team2Declarations += decl.points
    }
  }
  
  team1Points += team1Declarations
  team2Points += team2Declarations
  
  // Calculate hand total
  const handTotal = team1Points + team2Points
  
  // Calculate contract bonus
  const declarerTeam = getPlayerTeam(state.declarer)
  const contractThreshold = 162 // Half of deck + 1 (257 total - last trick bonus)
  const team1MadeContract = declarerTeam === 'team1' ? team1Points > contractThreshold : team2Points > contractThreshold
  
  let contractBonus = 0
  if (team1MadeContract) {
    contractBonus = 90 // Standard bonus for making contract
  }
  
  // Update scores
  const newHandScores: Record<TeamId, number> = {
    team1: team1Points + (team1MadeContract ? contractBonus : 0),
    team2: team2Points + (team1MadeContract ? 0 : contractBonus)
  }
  
  const newMatchScores: Record<TeamId, number> = {
    team1: state.matchScores.team1 + newHandScores.team1,
    team2: state.matchScores.team2 + newHandScores.team2
  }
  
  return {
    handScores: newHandScores,
    matchScores: newMatchScores,
    contractBonus
  }
}

// Apply a bid - player takes talon (2 hidden cards) and declares trump
export function applyBid(state: GameState, bid: TrumpCall): GameState {
  const newState = JSON.parse(JSON.stringify(state)) as GameState
  
  newState.bids.push(bid)
  newState.currentBid = bid
  newState.declarer = bid.playerId
  newState.trump = bid.suit
  newState.players[bid.playerId].isDeclarer = true
  
  newState.events.push({
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'bid',
    timestamp: Date.now(),
    playerId: bid.playerId,
    data: bid
  })
  
  // Player takes talon (2 hidden cards) into their hand
  if (newState.talon && newState.talon.length > 0) {
    const player = newState.players[bid.playerId]
    player.hand.push(...newState.talon)
    newState.talon = [] // Clear talon
  }
  
  // Move to play phase
  newState.phase = 'play'
  newState.currentPlayer = bid.playerId
  
  // Check for declarations
  if (newState.config.declarationsEnabled) {
    for (const player of PLAYER_ORDER) {
      const playerDecls = checkDeclarations(newState, player)
      newState.declarations.push(...playerDecls)
    }
  }
  
  return newState
}

// Apply a pass - player passes, next player can take talon
export function applyPass(state: GameState, playerId: PlayerId): GameState {
  const newState = JSON.parse(JSON.stringify(state)) as GameState
  
  newState.events.push({
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'pass',
    timestamp: Date.now(),
    playerId,
    data: null
  })
  
  // Check if talon is available (not yet taken)
  if (newState.talon && newState.talon.length > 0) {
    // Talon still available - pass to next player who can take it
    const nextPlayer = getNextPlayer(playerId)
    newState.currentPlayer = nextPlayer
  } else {
    // Talon already taken
    if (newState.currentBid) {
      const lastActions = newState.events.slice(-4)
      const passes = lastActions.filter(e => e.type === 'pass').length
      
      if (passes >= 3) {
        // Bidding complete
        newState.phase = 'play'
        newState.currentPlayer = getNextPlayer(newState.dealer)
      } else {
        newState.currentPlayer = getNextPlayer(playerId)
      }
    } else {
      // No bid yet - check if all passed
      const passes = newState.events.filter(e => e.type === 'pass').length
      if (passes >= 3) {
        // All passed - dealer must set trump (no talon)
        newState.currentPlayer = newState.dealer
        newState.phase = 'dealerChoice'
      } else {
        newState.currentPlayer = getNextPlayer(playerId)
      }
    }
  }
  
  return newState
}

// Dealer chooses trump when everyone passes (no talon)
export function applyDealerChoice(state: GameState, suit: Suit): GameState {
  const newState = JSON.parse(JSON.stringify(state)) as GameState
  
  const bid: TrumpCall = { playerId: newState.dealer, suit, level: 1 }
  newState.bids.push(bid)
  newState.currentBid = bid
  newState.declarer = newState.dealer
  newState.trump = suit
  newState.players[newState.dealer].isDeclarer = true
  
  newState.events.push({
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'bid',
    timestamp: Date.now(),
    playerId: newState.dealer,
    data: bid
  })
  
  // No talon - dealer keeps their 8 cards
  newState.phase = 'play'
  newState.currentPlayer = newState.dealer
  
  // Check for declarations
  if (newState.config.declarationsEnabled) {
    for (const player of PLAYER_ORDER) {
      const playerDecls = checkDeclarations(newState, player)
      newState.declarations.push(...playerDecls)
    }
  }
  
  return newState
}

// Get available bids for a player
export function getAvailableBids(state: GameState, playerId: PlayerId): TrumpCall[] {
  if (state.currentBid === null) {
    // First bid - can call any suit at level 1
    return [
      { suit: 'hearts', playerId, level: 1 },
      { suit: 'diamonds', playerId, level: 1 },
      { suit: 'clubs', playerId, level: 1 },
      { suit: 'spades', playerId, level: 1 }
    ]
  }
  
  // Can raise current bid
  const currentLevel = state.currentBid.level
  const bids: TrumpCall[] = []
  
  // Add same suit with higher level
  if (currentLevel < 4) {
    bids.push({ ...state.currentBid, playerId, level: currentLevel + 1 })
  }
  
  return bids
}

// Check if game is over
export function isGameOver(state: GameState): boolean {
  if (state.phase !== 'scoring') return false
  
  return (
    state.matchScores.team1 >= state.config.matchTargetScore ||
    state.matchScores.team2 >= state.config.matchTargetScore
  )
}
