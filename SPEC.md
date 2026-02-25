# Bela (Belote) Learning Desktop Application - Specification

## 1. Project Overview

**Project Name:** BelaLearn - Bela (Belote) Learning Platform

**Project Type:** Desktop Educational Application

**Core Feature Summary:** A full-featured Bela card game implementation with teaching capabilities, allowing users to learn and practice Bela against AI bots with rule enforcement, hints, and post-game analysis.

**Target Users:** 
- New players learning Bela rules
- Intermediate players wanting to improve their game
- Teachers/instructors demonstrating Bela gameplay

---

## 2. UI/UX Specification

### 2.1 Layout Structure

**Window Model:**
- Single main window (1200x800 minimum, resizable)
- Modal dialogs for: Game Over, Settings, Help
- Native window controls (minimize, maximize, close)

**Layout Areas:**
```
┌─────────────────────────────────────────────────────────────┐
│ Header Bar (Game Info, Scores, Controls)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                    ┌─────────────┐        │
│  │ Bot 2 (N)   │                    │ Bot 1 (W)   │        │
│  │             │                    │             │        │
│  └─────────────┘                    └─────────────┘        │
│                                                             │
│              ┌─────────────────────┐                        │
│              │   Current Trick     │                        │
│              │   (played cards)    │                        │
│              └─────────────────────┘                        │
│                                                             │
│  ┌─────────────┐                    ┌─────────────┐        │
│  │ Bot 3 (E)   │                    │ Player (S)  │        │
│  │             │                    │ (You)       │        │
│  └─────────────┘                    └─────────────┘        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Player Hand (playable cards highlighted)                   │
├─────────────────────────────────────────────────────────────┤
│ Action Bar (Hint, Explain, Pass, Declare)                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Visual Design

**Color Palette:**
- Primary: `#1a365d` (Deep Navy Blue)
- Secondary: `#2d3748` (Dark Gray)
- Accent: `#ed8936` (Warm Orange)
- Background: `#f7fafc` (Light Gray)
- Card Background: `#ffffff` (White)
- Trump Indicator: `#e53e3e` (Red)
- Legal Move: `#48bb78` (Green)
- Error/Illegal: `#e53e3e` (Red)
- Text Primary: `#1a202c` (Near Black)
- Text Secondary: `#718096` (Medium Gray)

**Card Colors:**
- Hearts: `#e53e3e` (Red)
- Diamonds: `#e53e3e` (Red)
- Clubs: `#1a202c` (Black)
- Spades: `#1a202c` (Black)

**Typography:**
- Font Family: "Segoe UI", "SF Pro Display", system-ui, sans-serif
- Card Values: "Georgia", serif (24px for cards, 18px for UI)
- Headers: 600 weight, 20px
- Body: 400 weight, 14px
- Scores: "Consolas", monospace, 16px

**Spacing System:**
- Base unit: 4px
- Card gap: 8px
- Section padding: 16px
- Component margins: 12px

**Visual Effects:**
- Cards: subtle drop shadow (`0 2px 4px rgba(0,0,0,0.1)`)
- Selected card: lift effect with enhanced shadow
- Legal cards: green border glow on hover
- Transitions: 150ms ease-in-out for all interactions

### 2.3 Components

**Card Component:**
- Size: 70x100px (desktop)
- States: default, hoverable, selected, disabled, playable
- Shows: suit symbol, rank value, card art (simplified)

**Player Seat:**
- Shows player name, team (color coded)
- Current turn indicator (highlight/glow)
- Card count badge

**Trick Display:**
- Shows 4 cards in cross pattern
- Card that won trick slightly highlighted
- Clear indication of who played each card

**Action Buttons:**
- Hint: Primary accent color
- Play Card: Large, prominent
- Pass/Continue: Secondary style
- Declare: Special styling for declarations

**Score Panel:**
- Current hand scores
- Match total scores
- Contract indicator

**Hint/Explanation Panel:**
- Slide-in panel or bottom section
- Clear recommendation
- Reasoning text

---

## 3. Functional Specification

### 3.1 Core Features

**Game Flow:**
1. Deal 8 cards to each player (32-card deck)
2. Bidding phase: players call trump (highest wins)
3. Card play phase: 8 tricks
4. Scoring: calculate hand score, update match score
5. Repeat until match target (usually 1000+ points)

**Card Deck:**
- 32 cards: 7, 8, 9, 10, J, Q, K, A in each suit
- Suits: Hearts, Diamonds, Clubs, Spades

**Bidding:**
- First player to the left of dealer calls trump
- Players can pass or call higher
- Highest caller becomes declarer
- Other team members play as defenders

**Card Play Rules:**
- Must follow suit of first card in trick
- If void in suit, must play trump (if trump in trick)
- If void in suit and no trump, can play any card
- Highest trump wins trick (if trump played)
- Highest card of leading suit wins (if no trump)
- Winner of trick leads next

**Scoring:**
- Trump cards: A=11, 10=10, K=4, Q=3, J=2, 9=0, 8=0, 7=0
- Non-trump: A=11, 10=10, K=4, Q=3, J=0, 9=0, 8=0, 7=0
- Last trick: +10 points
- All tricks (cap): +90 points (if playing without trump)
- Bela declaration: +20 points (K+Q of trump)
- Winning contract: + bonus points

**Declarations (Zvanja):**
- Bela: K+Q of trump in hand (20 points)
- Tierce: 3 consecutive cards (20 points)
- Quarte: 4 consecutive cards (50 points)
- Quint: 5 consecutive cards (100 points)
- Belot: K+Q of trump played together (20 points)

### 3.2 User Interactions

**Playing a Card:**
1. Click on card in hand
2. If legal, card plays to trick
3. If illegal, show error message + reason

**Hint System:**
1. Click Hint button
2. System evaluates all legal moves
3. Recommends best move based on heuristics
4. Shows recommendation + explanation

**Post-Game Analysis:**
- Viewable after each hand
- Shows all decisions made
- Grades each decision
- Provides overall score (0-100)

### 3.3 Data Flow

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                     React UI Layer                          │
│  (Components, State Management, Event Handlers)            │
├─────────────────────────────────────────────────────────────┤
│                    Game Controller                          │
│  (Coordinates UI, Engine, Bots)                             │
├──────────────────┬──────────────────┬──────────────────────┤
│   Rules Engine   │   Bot Engine     │  Analysis Engine     │
│  (legal_moves,   │  (choose_move,   │  (grade_decisions,   │
│   apply_move,    │   explain_move)  │   compute_score)     │
│   score_trick)   │                  │                      │
├──────────────────┴──────────────────┴──────────────────────┤
│                  Game State + Event Log                     │
│  (Immutable state, event sourcing)                         │
└─────────────────────────────────────────────────────────────┘
```

**Key Modules:**

1. **RulesEngine** (`engine/rules.ts`)
   - `createInitialState()`: Create new game state
   - `legalMoves(state, playerId)`: Get legal cards
   - `applyMove(state, move)`: Apply card play
   - `evaluateTrick(trick, trump)`: Determine winner
   - `scoreTrick(trick, trump)`: Calculate points
   - `endOfHandScoring(state)`: Final hand scoring
   - `checkDeclarations(state, playerId)`: Check for zvanja

2. **GameState** (`engine/state.ts`)
   - Immutable game state object
   - Event log for replay
   - Methods to create new state from events

3. **BotEngine** (`bots/index.ts`)
   - `BotLevel1`: Rule-based beginner bot
   - `BotLevel2`: Advanced heuristics bot
   - Both return move + explanation

4. **AnalysisEngine** (`analysis/index.ts`)
   - `gradeDecision(decision, optimal)`: Grade move
   - `computeGameScore(state)`: 0-100 grade
   - `generateReport(state)`: Full analysis

### 3.4 Edge Cases

- Player has no cards of leading suit
- Player has no trump but other player played trump
- All players pass in bidding (redeal)
- Declarer loses all tricks
- Tie in trick (should not happen in normal play)
- Empty event log (new game)

---

## 4. Acceptance Criteria

### 4.1 Core Functionality

- [ ] 32-card deck correctly generated and dealt
- [ ] Each player receives 8 cards
- [ ] Bidding phase works with trump selection
- [ ] All card play rules enforced (follow suit, trump rules)
- [ ] Correct winner determined for each trick
- [ ] Points calculated correctly per scoring rules
- [ ] Hand and match scores displayed accurately

### 4.2 Teaching Features

- [ ] Only legal cards are playable
- [ ] Illegal moves are rejected with explanation
- [ ] Hint button provides recommendation + reason
- [ ] Post-hand analysis shows decision grades
- [ ] Game score (0-100) computed and displayed

### 4.3 Bot AI

- [ ] Bot makes legal moves only
- [ ] Bot provides explanation for moves
- [ ] Level 1 bot is beatable by beginner
- [ ] Bots take turns correctly

### 4.4 UI/UX

- [ ] All cards displayed clearly with suits
- [ ] Current player clearly indicated
- [ ] Trick display shows all played cards
- [ ] Scores visible throughout game
- [ ] Responsive to window resize
- [ ] Smooth animations for card plays

### 4.5 Visual Checkpoints

1. **Game Start:** Empty table, cards in hand, scores at 0
2. **Bidding:** Trump indicator visible, current bidder highlighted
3. **Mid-Game:** Tricks visible, scores updating, clear turn indicator
4. **End of Hand:** Final scores, analysis panel available
5. **Hint Mode:** Recommended card highlighted, explanation visible

---

## 5. Technical Implementation

### 5.1 Project Structure

```
/bela-learn/
├── package.json
├── electron/
│   ├── main.ts           # Electron main process
│   └── preload.ts        # Preload script
├── src/
│   ├── index.tsx         # React entry
│   ├── App.tsx           # Main app component
│   ├── engine/
│   │   ├── rules.ts      # Core rules engine
│   │   ├── state.ts      # Game state management
│   │   ├── scoring.ts    # Scoring logic
│   │   └── types.ts      # TypeScript types
│   ├── bots/
│   │   ├── index.ts      # Bot factory
│   │   ├── botLevel1.ts  # Beginner bot
│   │   └── botLevel2.ts  # Advanced bot
│   ├── analysis/
│   │   └── index.ts      # Decision grading
│   ├── components/
│   │   ├── Card.tsx
│   │   ├── Hand.tsx
│   │   ├── Trick.tsx
│   │   ├── ScoreBoard.tsx
│   │   ├── PlayerSeat.tsx
│   │   └── HintPanel.tsx
│   └── styles/
│       └── index.css
└── dist/                 # Build output
```

### 5.2 Technology Stack

- **Runtime:** Electron 28+
- **Frontend:** React 18+
- **Language:** TypeScript
- **Build:** Vite + electron-builder
- **State:** React hooks (useReducer)

### 5.3 Configuration Options

Ruleset variants (stored in config):
- `mustFollowSuit`: boolean (default: true)
- `mustTrumpWhenVoid`: boolean (default: true)
- `overtrumpRequired`: boolean (default: false)
- `declarationsEnabled`: boolean (default: true)
- `lastTrickBonus`: boolean (default: true)
- `matchTargetScore`: number (default: 1001)
