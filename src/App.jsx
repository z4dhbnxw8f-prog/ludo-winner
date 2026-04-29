import { useState } from 'react'
import './App.css'

const TOKENS_PER_PLAYER = 4
const MAX_PROGRESS = 56
const FREE_MODE = 'free'
const STAKED_MODE = 'staked'
const DEFAULT_STAKE = 50

const PLAYERS = [
  {
    id: 'red',
    color: '#ef4444',
    label: 'Red',
    defaultName: 'Crimson Crew',
    startIndex: 0,
  },
  {
    id: 'green',
    color: '#22c55e',
    label: 'Green',
    defaultName: 'Emerald Squad',
    startIndex: 13,
  },
  {
    id: 'yellow',
    color: '#facc15',
    label: 'Yellow',
    defaultName: 'Golden Rollers',
    startIndex: 26,
  },
  {
    id: 'blue',
    color: '#38bdf8',
    label: 'Blue',
    defaultName: 'Azure Blitz',
    startIndex: 39,
  },
]

const SHOP_PACKS = [
  { id: 'small', label: 'Pocket Pack', coins: 250, price: '$2.99' },
  { id: 'medium', label: 'Victory Vault', coins: 700, price: '$6.99' },
  { id: 'large', label: 'Champion Crate', coins: 1500, price: '$12.99' },
]

const STAKE_OPTIONS = [25, 50, 100, 250]

const TRACK = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0],
]

const HOME_LANES = {
  red: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
  ],
  green: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
    [6, 7],
  ],
  yellow: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
    [7, 8],
  ],
  blue: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
    [8, 7],
  ],
}

const YARDS = {
  red: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  green: [
    [1, 11],
    [1, 13],
    [3, 11],
    [3, 13],
  ],
  yellow: [
    [11, 11],
    [11, 13],
    [13, 11],
    [13, 13],
  ],
  blue: [
    [11, 1],
    [11, 3],
    [13, 1],
    [13, 3],
  ],
}

const SAFE_TRACK_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47])
const BOARD_SIZE = 15
const BOARD_COORDS = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => [
  Math.floor(index / BOARD_SIZE),
  index % BOARD_SIZE,
])

function createInitialTokens() {
  return Object.fromEntries(
    PLAYERS.map((player) => [
      player.id,
      Array.from({ length: TOKENS_PER_PLAYER }, (_, index) => ({
        id: `${player.id}-${index + 1}`,
        progress: -1,
      })),
    ]),
  )
}

function createPlayers() {
  return PLAYERS.map((player) => ({
    id: player.id,
    name: player.defaultName,
    coins: 400,
    spentUsd: 0,
  }))
}

function createMatchState(mode = FREE_MODE, stake = DEFAULT_STAKE) {
  const openingLine =
    mode === FREE_MODE
      ? 'Free play room is live. Red rolls first.'
      : `Coin table is live. Every seat has posted ${stake} coins. Red rolls first.`

  return {
    activePlayerIndex: 0,
    diceValue: null,
    winnerId: null,
    tokensByPlayer: createInitialTokens(),
    activity: [openingLine],
    mode,
    stake,
    prizePool: mode === STAKED_MODE ? stake * PLAYERS.length : 0,
    locked: mode === STAKED_MODE,
  }
}

function createInitialChat(players, mode, stake) {
  return [
    {
      id: 1,
      author: 'Table Bot',
      playerId: 'system',
      text:
        mode === FREE_MODE
          ? `${players[0].name} opened a free-play room. Anyone can jump in without spending coins.`
          : `${players[0].name} opened a ${stake}-coin table. Winner takes the prize pool.`,
    },
    {
      id: 2,
      author: players[1].name,
      playerId: players[1].id,
      text: 'Ready when you are. First capture gets bragging rights.',
    },
  ]
}

function coordKey([row, column]) {
  return `${row}-${column}`
}

function getPlayerById(playerId) {
  return PLAYERS.find((player) => player.id === playerId)
}

function getAbsoluteTrackIndex(player, progress) {
  return (player.startIndex + progress) % TRACK.length
}

function getTokenCoordinate(player, progress) {
  if (progress < 0) {
    return null
  }

  if (progress <= 50) {
    return TRACK[getAbsoluteTrackIndex(player, progress)]
  }

  return HOME_LANES[player.id][progress - 51]
}

function getMovableTokenIndexes(playerId, tokensByPlayer, dieValue) {
  if (!dieValue) {
    return []
  }

  return tokensByPlayer[playerId]
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => {
      if (token.progress === MAX_PROGRESS) {
        return false
      }

      if (token.progress === -1) {
        return dieValue === 6
      }

      return token.progress + dieValue <= MAX_PROGRESS
    })
    .map(({ index }) => index)
}

function buildBoardCells(tokensByPlayer) {
  const cells = new Map()

  BOARD_COORDS.forEach((coord) => {
    cells.set(coordKey(coord), {
      coord,
      type: 'blank',
      zone: '',
      tokens: [],
    })
  })

  TRACK.forEach((coord, index) => {
    cells.set(coordKey(coord), {
      coord,
      type: 'track',
      zone: SAFE_TRACK_INDEXES.has(index) ? 'safe' : '',
      tokens: [],
    })
  })

  Object.entries(HOME_LANES).forEach(([playerId, coords]) => {
    coords.forEach((coord) => {
      cells.set(coordKey(coord), {
        coord,
        type: 'lane',
        zone: playerId,
        tokens: [],
      })
    })
  })

  Object.entries(YARDS).forEach(([playerId, coords]) => {
    coords.forEach((coord) => {
      cells.set(coordKey(coord), {
        coord,
        type: 'yard',
        zone: playerId,
        tokens: [],
      })
    })
  })

  cells.set(coordKey([7, 7]), {
    coord: [7, 7],
    type: 'goal',
    zone: 'goal',
    tokens: [],
  })

  PLAYERS.forEach((player) => {
    tokensByPlayer[player.id].forEach((token, index) => {
      const coord =
        token.progress === -1
          ? YARDS[player.id][index]
          : getTokenCoordinate(player, token.progress)

      if (!coord) {
        return
      }

      cells.get(coordKey(coord)).tokens.push({
        playerId: player.id,
        tokenIndex: index,
        tokenId: token.id,
      })
    })
  })

  return cells
}

function App() {
  const [players, setPlayers] = useState(() => createPlayers())
  const [selectedStake, setSelectedStake] = useState(DEFAULT_STAKE)
  const [match, setMatch] = useState(() => createMatchState(FREE_MODE, DEFAULT_STAKE))
  const [chatMessages, setChatMessages] = useState(() =>
    createInitialChat(createPlayers(), FREE_MODE, DEFAULT_STAKE),
  )
  const [chatAuthorId, setChatAuthorId] = useState(PLAYERS[0].id)
  const [draftMessage, setDraftMessage] = useState('')

  const activePlayer = PLAYERS[match.activePlayerIndex]
  const activePlayerProfile = players[match.activePlayerIndex]
  const movableTokenIndexes = getMovableTokenIndexes(
    activePlayer.id,
    match.tokensByPlayer,
    match.diceValue,
  )
  const boardCells = buildBoardCells(match.tokensByPlayer)
  const canAffordStakedRoom = players.every((player) => player.coins >= selectedStake)

  function pushSystemChat(text) {
    setChatMessages((currentMessages) => [
      ...currentMessages,
      {
        id: currentMessages.length + 1,
        author: 'Table Bot',
        playerId: 'system',
        text,
      },
    ])
  }

  function updatePlayerName(playerId, nextName) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              name: nextName || getPlayerById(playerId).defaultName,
            }
          : player,
      ),
    )
  }

  function startMatch(mode) {
    if (mode === STAKED_MODE && !canAffordStakedRoom) {
      pushSystemChat(
        `Not enough coins at the table for a ${selectedStake}-coin room. Top up in the shop or switch to free play.`,
      )
      return
    }

    if (mode === STAKED_MODE) {
      setPlayers((currentPlayers) =>
        currentPlayers.map((player) => ({
          ...player,
          coins: player.coins - selectedStake,
        })),
      )
    }

    setMatch(createMatchState(mode, selectedStake))
    setChatMessages(createInitialChat(players, mode, selectedStake))
    setChatAuthorId(PLAYERS[0].id)
    setDraftMessage('')
  }

  function resetCurrentMode() {
    startMatch(match.mode)
  }

  function purchasePack(pack) {
    const splitCost = Number((Number.parseFloat(pack.price.slice(1)) / PLAYERS.length).toFixed(2))

    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => ({
        ...player,
        coins: player.coins + pack.coins,
        spentUsd: Number((player.spentUsd + splitCost).toFixed(2)),
      })),
    )

    pushSystemChat(
      `${pack.label} purchased: every seat received ${pack.coins} coins. Replace this demo action with a real checkout flow.`,
    )
  }

  function rollDice() {
    setMatch((currentMatch) => {
      if (currentMatch.winnerId || currentMatch.diceValue !== null) {
        return currentMatch
      }

      const dieValue = Math.floor(Math.random() * 6) + 1
      const currentPlayer = PLAYERS[currentMatch.activePlayerIndex]
      const currentPlayerName = players[currentMatch.activePlayerIndex].name
      const movableIndexes = getMovableTokenIndexes(
        currentPlayer.id,
        currentMatch.tokensByPlayer,
        dieValue,
      )

      if (movableIndexes.length === 0) {
        const nextPlayerIndex = (currentMatch.activePlayerIndex + 1) % PLAYERS.length

        return {
          ...currentMatch,
          activePlayerIndex: nextPlayerIndex,
          diceValue: null,
          activity: [
            `${currentPlayerName} rolled ${dieValue}, but no token could move.`,
            ...currentMatch.activity,
          ].slice(0, 10),
        }
      }

      return {
        ...currentMatch,
        diceValue: dieValue,
        activity: [
          `${currentPlayerName} rolled a ${dieValue}. Choose a token to move.`,
          ...currentMatch.activity,
        ].slice(0, 10),
      }
    })
  }

  function moveToken(tokenIndex) {
    setMatch((currentMatch) => {
      if (currentMatch.winnerId || currentMatch.diceValue === null) {
        return currentMatch
      }

      const currentPlayer = PLAYERS[currentMatch.activePlayerIndex]
      const currentPlayerName = players[currentMatch.activePlayerIndex].name
      const movableIndexes = getMovableTokenIndexes(
        currentPlayer.id,
        currentMatch.tokensByPlayer,
        currentMatch.diceValue,
      )

      if (!movableIndexes.includes(tokenIndex)) {
        return currentMatch
      }

      const tokensByPlayer = Object.fromEntries(
        Object.entries(currentMatch.tokensByPlayer).map(([playerId, tokens]) => [
          playerId,
          tokens.map((token) => ({ ...token })),
        ]),
      )

      const token = tokensByPlayer[currentPlayer.id][tokenIndex]
      const nextProgress =
        token.progress === -1 ? 0 : token.progress + currentMatch.diceValue
      token.progress = nextProgress

      const capturedNames = []

      if (nextProgress <= 50) {
        const landingTrackIndex = getAbsoluteTrackIndex(currentPlayer, nextProgress)

        if (!SAFE_TRACK_INDEXES.has(landingTrackIndex)) {
          PLAYERS.filter((player) => player.id !== currentPlayer.id).forEach((player) => {
            tokensByPlayer[player.id].forEach((opponentToken) => {
              if (opponentToken.progress < 0 || opponentToken.progress > 50) {
                return
              }

              const opponentTrackIndex = getAbsoluteTrackIndex(player, opponentToken.progress)

              if (opponentTrackIndex === landingTrackIndex) {
                opponentToken.progress = -1
                capturedNames.push(players.find((entry) => entry.id === player.id).name)
              }
            })
          })
        }
      }

      const playerFinished = tokensByPlayer[currentPlayer.id].every(
        (playerToken) => playerToken.progress === MAX_PROGRESS,
      )

      const earnedExtraTurn = currentMatch.diceValue === 6 && !playerFinished
      const nextPlayerIndex = earnedExtraTurn
        ? currentMatch.activePlayerIndex
        : (currentMatch.activePlayerIndex + 1) % PLAYERS.length

      const moveLabel =
        nextProgress === MAX_PROGRESS
          ? `${currentPlayerName} marched token ${tokenIndex + 1} home and finished it.`
          : `${currentPlayerName} moved token ${tokenIndex + 1} by ${currentMatch.diceValue} steps.`
      const captureLabel =
        capturedNames.length > 0
          ? ` Captured ${capturedNames.join(' and ')} on the way.`
          : ''
      const turnLabel = earnedExtraTurn ? ' Extra turn earned.' : ''
      const winnerLabel = playerFinished
        ? currentMatch.mode === STAKED_MODE
          ? ` ${currentPlayerName} wins the ${currentMatch.prizePool}-coin pot.`
          : ` ${currentPlayerName} wins the free-play match.`
        : ''

      if (playerFinished && currentMatch.mode === STAKED_MODE) {
        setPlayers((currentPlayers) =>
          currentPlayers.map((player) =>
            player.id === currentPlayer.id
              ? { ...player, coins: player.coins + currentMatch.prizePool }
              : player,
          ),
        )
      }

      return {
        ...currentMatch,
        activePlayerIndex: nextPlayerIndex,
        diceValue: null,
        winnerId: playerFinished ? currentPlayer.id : null,
        tokensByPlayer,
        activity: [`${moveLabel}${captureLabel}${turnLabel}${winnerLabel}`, ...currentMatch.activity].slice(
          0,
          10,
        ),
      }
    })
  }

  function sendMessage(event) {
    event.preventDefault()

    const trimmedMessage = draftMessage.trim()

    if (!trimmedMessage) {
      return
    }

    const author = players.find((player) => player.id === chatAuthorId)

    setChatMessages((currentMessages) => [
      ...currentMessages,
      {
        id: currentMessages.length + 1,
        author: author.name,
        playerId: author.id,
        text: trimmedMessage,
      },
    ])
    setDraftMessage('')
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Vite + React local multiplayer prototype</p>
          <h1>Ludo Winner</h1>
          <p className="hero-copy">
            Players can still join free tables, but you can also spin up coin-staked
            rooms funded from the in-game shop. This demo uses mock purchases and a
            virtual wallet so the game loop is ready for a real payment backend later.
          </p>
        </div>

        <div className="hero-actions">
          <button type="button" className="primary-button" onClick={rollDice}>
            {match.diceValue === null ? 'Roll Dice' : `Dice: ${match.diceValue}`}
          </button>
          <button type="button" className="secondary-button" onClick={resetCurrentMode}>
            Restart Table
          </button>
        </div>

        <div className="status-grid">
          <article className="status-card">
            <span>Current turn</span>
            <strong>{activePlayerProfile.name}</strong>
            <small>{getPlayerById(activePlayer.id).label} seat</small>
          </article>
          <article className="status-card">
            <span>Table type</span>
            <strong>{match.mode === FREE_MODE ? 'Free play' : `${match.stake} coins / seat`}</strong>
            <small>
              {match.mode === FREE_MODE
                ? 'Zero-cost matches stay available'
                : `${match.prizePool} coins in the pot`}
            </small>
          </article>
          <article className="status-card">
            <span>Match state</span>
            <strong>
              {match.winnerId
                ? `${players.find((player) => player.id === match.winnerId).name} won`
                : 'In progress'}
            </strong>
            <small>First team to bring home all 4 tokens wins</small>
          </article>
        </div>
      </section>

      <section className="table-layout">
        <div className="board-panel">
          <div className="board-header">
            <div>
              <p className="panel-label">Board</p>
              <h2>Tap a token after rolling</h2>
            </div>
            <span className={`turn-chip turn-${activePlayer.id}`}>
              {activePlayerProfile.name}'s move
            </span>
          </div>

          <div className="board">
            <div className="quadrant quadrant-red"></div>
            <div className="quadrant quadrant-green"></div>
            <div className="quadrant quadrant-blue"></div>
            <div className="quadrant quadrant-yellow"></div>
            <div className="goal-mark">HOME</div>

            {BOARD_COORDS.map((coord) => {
              const cell = boardCells.get(coordKey(coord))
              const isMovableCell = cell.tokens.some(
                (token) =>
                  token.playerId === activePlayer.id &&
                  movableTokenIndexes.includes(token.tokenIndex),
              )

              return (
                <button
                  type="button"
                  key={coordKey(coord)}
                  className={[
                    'board-cell',
                    `cell-${cell.type}`,
                    cell.zone ? `zone-${cell.zone}` : '',
                    isMovableCell ? 'is-movable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    gridRow: coord[0] + 1,
                    gridColumn: coord[1] + 1,
                  }}
                  onClick={() => {
                    const activeToken = cell.tokens.find(
                      (tokenEntry) =>
                        tokenEntry.playerId === activePlayer.id &&
                        movableTokenIndexes.includes(tokenEntry.tokenIndex),
                    )

                    if (activeToken) {
                      moveToken(activeToken.tokenIndex)
                    }
                  }}
                >
                  {cell.zone === 'safe' && <span className="safe-dot" />}
                  {cell.tokens.length > 0 && (
                    <span className="token-stack">
                      {cell.tokens.map((tokenEntry) => {
                        const player = getPlayerById(tokenEntry.playerId)
                        const canMove =
                          tokenEntry.playerId === activePlayer.id &&
                          movableTokenIndexes.includes(tokenEntry.tokenIndex)

                        return (
                          <span
                            key={tokenEntry.tokenId}
                            className={`token token-${tokenEntry.playerId} ${
                              canMove ? 'token-pulse' : ''
                            }`}
                            title={`${player.label} token ${tokenEntry.tokenIndex + 1}`}
                          >
                            {tokenEntry.tokenIndex + 1}
                          </span>
                        )
                      })}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <aside className="sidebar">
          <section className="sidebar-card">
            <div className="sidebar-heading">
              <div>
                <p className="panel-label">Tables</p>
                <h2>Choose your section</h2>
              </div>
            </div>

            <div className="section-grid">
              <article className="table-section table-section-free">
                <p className="section-kicker">Normal Games</p>
                <h3>Casual room</h3>
                <p>
                  Jump into a match with no coins required. This keeps the game open
                  for players who just want a standard Ludo session.
                </p>
                <button
                  type="button"
                  className="primary-button full-width"
                  onClick={() => startMatch(FREE_MODE)}
                >
                  Start free match
                </button>
              </article>

              <article className="table-section table-section-staked">
                <p className="section-kicker">Gamblers</p>
                <h3>Coin table</h3>
                <p>
                  Every player posts the same stake, and the winner takes the full
                  pot. Make sure every seat has enough coins first.
                </p>

                <div className="stake-picker">
                  {STAKE_OPTIONS.map((stake) => (
                    <button
                      key={stake}
                      type="button"
                      className={`stake-chip ${selectedStake === stake ? 'stake-chip-active' : ''}`}
                      onClick={() => setSelectedStake(stake)}
                    >
                      {stake} coins
                    </button>
                  ))}
                </div>

                <div className="table-summary">
                  <p>
                    A {selectedStake}-coin table charges every player the same stake and
                    pays {selectedStake * PLAYERS.length} coins to the winner.
                  </p>
                  {!canAffordStakedRoom && (
                    <small>Some seats do not have enough coins for this stake yet.</small>
                  )}
                </div>

                <button
                  type="button"
                  className="primary-button full-width"
                  onClick={() => startMatch(STAKED_MODE)}
                >
                  Open coin table
                </button>
              </article>
            </div>
          </section>

          <section className="sidebar-card">
            <div className="sidebar-heading">
              <div>
                <p className="panel-label">Seats</p>
                <h2>Player setup</h2>
              </div>
            </div>
            <div className="player-list">
              {players.map((player, index) => {
                const meta = getPlayerById(player.id)
                const finishedTokens = match.tokensByPlayer[player.id].filter(
                  (token) => token.progress === MAX_PROGRESS,
                ).length

                return (
                  <article
                    key={player.id}
                    className={`player-card ${
                      match.activePlayerIndex === index ? 'player-card-active' : ''
                    }`}
                  >
                    <div className="player-swatch" style={{ background: meta.color }}></div>
                    <div className="player-copy">
                      <label htmlFor={`player-${player.id}`}>{meta.label} player</label>
                      <input
                        id={`player-${player.id}`}
                        value={player.name}
                        onChange={(event) => updatePlayerName(player.id, event.target.value)}
                      />
                      <small>
                        {finishedTokens}/4 finished • {player.coins} coins • ${player.spentUsd.toFixed(2)} spent
                      </small>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="sidebar-card">
            <div className="sidebar-heading">
              <div>
                <p className="panel-label">Shop</p>
                <h2>Buy game coins</h2>
              </div>
            </div>
            <p className="shop-copy">
              These buttons simulate a real-money checkout. In production, replace them
              with Stripe, Paystack, Flutterwave, or your preferred payment flow.
            </p>
            <div className="shop-grid">
              {SHOP_PACKS.map((pack) => (
                <article key={pack.id} className="shop-card">
                  <strong>{pack.label}</strong>
                  <span>{pack.coins} coins</span>
                  <small>{pack.price}</small>
                  <button
                    type="button"
                    className="secondary-button shop-button"
                    onClick={() => purchasePack(pack)}
                  >
                    Buy coins
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="sidebar-card">
            <div className="sidebar-heading">
              <div>
                <p className="panel-label">Activity</p>
                <h2>Match feed</h2>
              </div>
            </div>
            <ul className="activity-list">
              {match.activity.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="sidebar-card chat-card">
            <div className="sidebar-heading">
              <div>
                <p className="panel-label">Chat</p>
                <h2>Table talk</h2>
              </div>
            </div>

            <div className="chat-list">
              {chatMessages.map((message) => (
                <article key={message.id} className="chat-bubble">
                  <div className="chat-meta">
                    <span
                      className={`chat-badge ${
                        message.playerId !== 'system' ? `badge-${message.playerId}` : 'badge-system'
                      }`}
                    >
                      {message.author}
                    </span>
                  </div>
                  <p>{message.text}</p>
                </article>
              ))}
            </div>

            <form className="chat-form" onSubmit={sendMessage}>
              <label className="chat-field">
                <span>Send as</span>
                <select
                  value={chatAuthorId}
                  onChange={(event) => setChatAuthorId(event.target.value)}
                >
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="chat-field">
                <span>Message</span>
                <textarea
                  rows="3"
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder="Call your shot, celebrate a capture, or taunt the table..."
                />
              </label>

              <button type="submit" className="primary-button chat-send">
                Send message
              </button>
            </form>
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
