import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  BOARD_COORDS,
  DEFAULT_STAKE,
  FREE_MODE,
  PLAYERS,
  SHOP_PACKS,
  STAKED_MODE,
  STAKE_OPTIONS,
  buildBoardCells,
  coordKey,
  getMovableTokenIndexes,
  getPlayerById,
} from './gameCore.js'

const DICE_PIPS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
}

async function request(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.')
  }

  return payload
}

function DiceFace({ value, isRolling }) {
  const pips = DICE_PIPS[value] ?? []

  return (
    <div className={`dice-shell ${isRolling ? 'dice-shell-rolling' : ''}`}>
      <div className="dice-face">
        {Array.from({ length: 9 }, (_, index) => (
          <span
            key={index}
            className={`dice-pip ${pips.includes(index + 1) ? 'dice-pip-visible' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

function App() {
  const [playerName, setPlayerName] = useState('Crimson Crew')
  const [joinCode, setJoinCode] = useState('')
  const [selectedStake, setSelectedStake] = useState(DEFAULT_STAKE)
  const [selectedMatchType, setSelectedMatchType] = useState('1v1')
  const [session, setSession] = useState(null)
  const [room, setRoom] = useState(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [connectionState, setConnectionState] = useState('offline')
  const [isRolling, setIsRolling] = useState(false)
  const [lastDiceValue, setLastDiceValue] = useState(1)

  useEffect(() => {
    if (!session) {
      return undefined
    }

    const stream = new EventSource(
      `/api/rooms/${session.roomCode}/events?token=${encodeURIComponent(session.playerToken)}`,
    )

    stream.onopen = () => setConnectionState('connected')
    stream.onmessage = (event) => {
      const nextRoom = JSON.parse(event.data)
      setRoom(nextRoom)
      if (nextRoom.match?.diceValue) {
        setLastDiceValue(nextRoom.match.diceValue)
      }
      setConnectionState('connected')
    }
    stream.onerror = () => setConnectionState('reconnecting')

    return () => {
      stream.close()
      setConnectionState('offline')
    }
  }, [session])

  const activePlayer = room ? PLAYERS[room.match.activePlayerIndex] : PLAYERS[0]
  const yourSeat = room?.you?.seat ?? null
  const isYourTurn = room ? activePlayer.id === yourSeat : false
  const boardCells = useMemo(
    () => buildBoardCells(room?.match?.tokensByPlayer ?? { red: [], green: [] }),
    [room],
  )
  const movableTokenIndexes = room
    ? getMovableTokenIndexes(yourSeat, room.match.tokensByPlayer, room.match.diceValue)
    : []

  async function createRoom(mode) {
    try {
      setIsBusy(true)
      setErrorMessage('')
      const payload = await request('/api/rooms', {
        playerName: playerName.trim() || 'Host Player',
        mode,
        stake: selectedStake,
        matchType: selectedMatchType,
      })
      setSession({
        roomCode: payload.room.roomCode,
        playerToken: payload.playerToken,
      })
      setRoom(payload.room)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsBusy(false)
    }
  }

  async function joinRoom() {
    try {
      setIsBusy(true)
      setErrorMessage('')
      const payload = await request('/api/rooms/join', {
        roomCode: joinCode.trim().toUpperCase(),
        playerName: playerName.trim() || 'Guest Challenger',
      })
      setSession({
        roomCode: payload.room.roomCode,
        playerToken: payload.playerToken,
      })
      setRoom(payload.room)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsBusy(false)
    }
  }

  async function callRoomAction(action, body = {}) {
    if (!session) {
      return
    }

    try {
      setErrorMessage('')
      if (action === 'roll') {
        setIsRolling(true)
      }
      await request(`/api/rooms/${session.roomCode}/${action}`, {
        token: session.playerToken,
        ...body,
      })
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      if (action === 'roll') {
        window.setTimeout(() => {
          setIsRolling(false)
        }, 850)
      }
    }
  }

  async function sendMessage(event) {
    event.preventDefault()

    if (!draftMessage.trim()) {
      return
    }

    await callRoomAction('chat', {
      text: draftMessage.trim(),
    })
    setDraftMessage('')
  }

  if (!room || !session) {
    return (
      <main className="app-shell">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Online multiplayer Ludo with instant dice</p>
            <h1>Ludo Winner</h1>
            <p className="hero-copy">
              Create a room, choose the match format, share the code, and play live with a second device.
              The game updates board state, chat, dice rolls, and turn order in real time.
            </p>
          </div>
        </section>

        <section className="table-layout table-layout-single">
          <section className="sidebar-card lobby-card">
            <div className="sidebar-heading">
              <div>
                <p className="panel-label">Your Seat</p>
                <h2>Set your player name</h2>
              </div>
            </div>

            <label className="chat-field">
              <span>Player name</span>
              <input
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Enter your display name"
              />
            </label>

            <div className="section-grid">
              <article className="table-section table-section-free">
                <p className="section-kicker">Match type</p>
                <h3>Choose a game format</h3>
                <p>Select the exact team layout you want to play.</p>
                <div className="match-type-picker">
                  {['1v1', '2v2', '3v3', '4v4'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`size-chip ${selectedMatchType === option ? 'size-chip-active' : ''}`}
                      onClick={() => setSelectedMatchType(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </article>
              <article className="table-section table-section-free">
                <p className="section-kicker">Normal Games</p>
                <h3>Create a free room</h3>
                <p>Open a zero-cost room and invite a matched opponent.</p>
                <button
                  type="button"
                  className="primary-button full-width"
                  onClick={() => createRoom(FREE_MODE)}
                  disabled={isBusy}
                >
                  Create free room
                </button>
              </article>

              <article className="table-section table-section-staked">
                <p className="section-kicker">Gamblers</p>
                <h3>Create a coin room</h3>
                <p>Choose the stake, invite one opponent, and let the winner take the pot.</p>
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
                <button
                  type="button"
                  className="primary-button full-width"
                  onClick={() => createRoom(STAKED_MODE)}
                  disabled={isBusy}
                >
                  Create coin room
                </button>
              </article>
            </div>

            <div className="join-panel">
              <div>
                <p className="panel-label">Join Room</p>
                <h2>Already have a code?</h2>
              </div>
              <div className="join-row">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="Enter 6-character code"
                />
                <button type="button" className="secondary-button" onClick={joinRoom} disabled={isBusy}>
                  Join
                </button>
              </div>
            </div>

            <div className="notes-card">
              <strong>How to test on two devices</strong>
              <p>1. Run `npm run dev`.</p>
              <p>2. Open the URL from your computer and create a room.</p>
              <p>3. On the second device, visit the same computer IP and enter the room code.</p>
            </div>

            {errorMessage && <p className="error-banner">{errorMessage}</p>}
          </section>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">2-player online multiplayer with chat</p>
          <h1>Ludo Winner</h1>
          <p className="hero-copy">
            Room <strong>{room.roomCode}</strong> is live. Share that code with your
            opponent and both devices will stay synced through the local room server.
          </p>
        </div>

        <div className="hero-actions">
          <div className="dice-panel">
            <DiceFace value={room.match.diceValue ?? lastDiceValue} isRolling={isRolling} />
            <div className="dice-copy">
              <span>Live die</span>
              <strong>
                {isRolling
                  ? 'Rolling...'
                  : room.match.diceValue === null
                    ? `Last roll: ${lastDiceValue}`
                    : `Current roll: ${room.match.diceValue}`}
              </strong>
            </div>
          </div>
          <div className="room-chip-group">
            <span className="room-chip">{room.matchType || '1v1'} match</span>
            <span className="room-chip">{room.mode === FREE_MODE ? 'Free play' : `${room.stake} coins`}</span>
          </div>
        </div>

        <div className="status-grid">
          <article className="status-card">
            <span>Room code</span>
            <strong>{room.roomCode}</strong>
            <small>{connectionState}</small>
          </article>
          <article className="status-card">
            <span>Table type</span>
            <strong>{room.mode === FREE_MODE ? 'Free play' : `${room.stake} coins / player`}</strong>
            <small>{room.mode === FREE_MODE ? 'No stake required' : `${room.prizePool} coins in the pot`}</small>
          </article>
          <article className="status-card">
            <span>Current turn</span>
            <strong>{room.players.find((player) => player.seat === activePlayer.id)?.name}</strong>
            <small>{isYourTurn ? 'Your turn on this device' : 'Waiting for the other device'}</small>
          </article>
        </div>

        {errorMessage && <p className="error-banner">{errorMessage}</p>}
      </section>

      <section className="table-layout">
        <div className="board-panel">
          <div className="board-header">
            <div>
              <p className="panel-label">Board</p>
              <h2>{room.status === 'waiting' ? 'Waiting for a second player' : 'Live match'}</h2>
            </div>
            <span className={`turn-chip turn-${activePlayer.id}`}>
              {room.players.find((player) => player.seat === activePlayer.id)?.name}'s move
            </span>
          </div>

          <div className="board-frame">
            <div className="board-side board-side-top">
              <span className="board-seat-tag board-seat-green">Green Home</span>
            </div>

            <div className="board-side board-side-left">
              <span className="board-seat-tag board-seat-red">Red Launch</span>
            </div>

            <div className="board-side board-side-right">
              <span className="board-seat-tag board-seat-green">Green Lane</span>
            </div>

            <div className="board-side board-side-bottom">
              <span className="board-seat-tag board-seat-red">Red Lane</span>
            </div>

            <div className="board">
            <div className="quadrant quadrant-red"></div>
            <div className="quadrant quadrant-green"></div>
            <div className="track-ribbon track-ribbon-horizontal"></div>
            <div className="track-ribbon track-ribbon-vertical"></div>
            <div className="goal-mark">DUEL</div>

            {BOARD_COORDS.map((coord) => {
              const cell = boardCells.get(coordKey(coord))
              const isMovableCell = cell.tokens.some(
                (token) =>
                  token.playerId === yourSeat &&
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
                        tokenEntry.playerId === yourSeat &&
                        movableTokenIndexes.includes(tokenEntry.tokenIndex),
                    )

                    if (activeToken) {
                      callRoomAction('move', { tokenIndex: activeToken.tokenIndex })
                    }
                  }}
                  disabled={!isMovableCell}
                >
                  {cell.zone === 'safe' && <span className="safe-dot" />}
                  {cell.tokens.length > 0 && (
                    <span className="token-stack">
                      {cell.tokens.map((tokenEntry) => {
                        const player = getPlayerById(tokenEntry.playerId)
                        const canMove =
                          tokenEntry.playerId === yourSeat &&
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
        </div>

        <aside className="sidebar">
          <section className="sidebar-card">
            <div className="sidebar-heading">
              <div>
                <p className="panel-label">Players</p>
                <h2>Two-device seats</h2>
              </div>
            </div>
            <div className="player-list">
              {room.players.map((player) => (
                <article
                  key={player.seat}
                  className={`player-card ${activePlayer.id === player.seat ? 'player-card-active' : ''}`}
                >
                  <div
                    className="player-swatch"
                    style={{ background: getPlayerById(player.seat).color }}
                  ></div>
                  <div className="player-copy">
                    <label>{player.label} player</label>
                    <strong>{player.name}</strong>
                    <small>
                      {player.connected ? 'Connected' : 'Offline'} • {player.coins} coins • $
                      {player.spentUsd.toFixed(2)} spent
                    </small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="sidebar-card">
            <div className="sidebar-heading">
              <div>
                <p className="panel-label">Shop</p>
                <h2>Buy coins</h2>
              </div>
            </div>
            <p className="shop-copy">
              These purchases are mock top-ups for now, but they sync to both devices
              through the room server.
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
                    onClick={() => callRoomAction('purchase', { packId: pack.id })}
                  >
                    Buy
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
              {room.match.activity.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="sidebar-card chat-card">
            <div className="sidebar-heading">
              <div>
                <p className="panel-label">Chat</p>
                <h2>Live room chat</h2>
              </div>
            </div>

            <div className="chat-list">
              {room.chatMessages.map((message) => (
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
                <span>Message</span>
                <textarea
                  rows="3"
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder="Send a message to the other device..."
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
