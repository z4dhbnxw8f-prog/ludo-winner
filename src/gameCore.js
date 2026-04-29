export const TOKENS_PER_PLAYER = 4
export const MAX_PROGRESS = 56
export const FREE_MODE = 'free'
export const STAKED_MODE = 'staked'
export const DEFAULT_STAKE = 50

export const PLAYERS = [
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
]

export const SHOP_PACKS = [
  { id: 'small', label: 'Pocket Pack', coins: 250, price: '$2.99' },
  { id: 'medium', label: 'Victory Vault', coins: 700, price: '$6.99' },
  { id: 'large', label: 'Champion Crate', coins: 1500, price: '$12.99' },
]

export const STAKE_OPTIONS = [25, 50, 100, 250]

export const TRACK = [
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

export const HOME_LANES = {
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
}

export const YARDS = {
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
}

export const SAFE_TRACK_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47])
export const BOARD_SIZE = 15
export const BOARD_COORDS = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => [
  Math.floor(index / BOARD_SIZE),
  index % BOARD_SIZE,
])

export function getPlayerById(playerId) {
  return PLAYERS.find((player) => player.id === playerId)
}

export function createInitialTokens() {
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

export function createPlayerSeat(player, name) {
  return {
    seat: player.id,
    name: name || player.defaultName,
    coins: 400,
    spentUsd: 0,
    connected: false,
  }
}

export function createMatchState(mode = FREE_MODE, stake = DEFAULT_STAKE) {
  return {
    activePlayerIndex: 0,
    diceValue: null,
    winnerId: null,
    tokensByPlayer: createInitialTokens(),
    activity: [
      mode === FREE_MODE
        ? 'Free play room is live. Red rolls first.'
        : `Coin table is live. Each player posted ${stake} coins. Red rolls first.`,
    ],
    mode,
    stake,
    prizePool: mode === STAKED_MODE ? stake * PLAYERS.length : 0,
  }
}

export function createInitialChat(players, mode, stake) {
  return [
    {
      id: 1,
      author: 'Table Bot',
      playerId: 'system',
      text:
        mode === FREE_MODE
          ? `${players[0].name} opened a free-play room. Share the room code with your opponent.`
          : `${players[0].name} opened a ${stake}-coin room. The winner takes the full pot.`,
    },
  ]
}

export function coordKey([row, column]) {
  return `${row}-${column}`
}

export function getAbsoluteTrackIndex(player, progress) {
  return (player.startIndex + progress) % TRACK.length
}

export function getTokenCoordinate(player, progress) {
  if (progress < 0) {
    return null
  }

  if (progress <= 50) {
    return TRACK[getAbsoluteTrackIndex(player, progress)]
  }

  return HOME_LANES[player.id][progress - 51]
}

export function getMovableTokenIndexes(playerId, tokensByPlayer, dieValue) {
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

export function buildBoardCells(tokensByPlayer) {
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

export function applyRoll(match, playersBySeat) {
  if (match.winnerId || match.diceValue !== null) {
    return match
  }

  const dieValue = Math.floor(Math.random() * 6) + 1
  const currentPlayer = PLAYERS[match.activePlayerIndex]
  const currentPlayerName = playersBySeat[currentPlayer.id].name
  const movableIndexes = getMovableTokenIndexes(
    currentPlayer.id,
    match.tokensByPlayer,
    dieValue,
  )

  if (movableIndexes.length === 0) {
    return {
      ...match,
      activePlayerIndex: (match.activePlayerIndex + 1) % PLAYERS.length,
      diceValue: null,
      activity: [
        `${currentPlayerName} rolled ${dieValue}, but no token could move.`,
        ...match.activity,
      ].slice(0, 12),
    }
  }

  return {
    ...match,
    diceValue: dieValue,
    activity: [
      `${currentPlayerName} rolled a ${dieValue}. Choose a token to move.`,
      ...match.activity,
    ].slice(0, 12),
  }
}

export function applyMove(match, playersBySeat, playerId, tokenIndex) {
  const currentPlayer = PLAYERS[match.activePlayerIndex]

  if (currentPlayer.id !== playerId || match.winnerId || match.diceValue === null) {
    return match
  }

  const movableIndexes = getMovableTokenIndexes(
    currentPlayer.id,
    match.tokensByPlayer,
    match.diceValue,
  )

  if (!movableIndexes.includes(tokenIndex)) {
    return match
  }

  const tokensByPlayer = Object.fromEntries(
    Object.entries(match.tokensByPlayer).map(([seat, tokens]) => [
      seat,
      tokens.map((token) => ({ ...token })),
    ]),
  )

  const token = tokensByPlayer[currentPlayer.id][tokenIndex]
  const nextProgress = token.progress === -1 ? 0 : token.progress + match.diceValue
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
            capturedNames.push(playersBySeat[player.id].name)
          }
        })
      })
    }
  }

  const playerFinished = tokensByPlayer[currentPlayer.id].every(
    (playerToken) => playerToken.progress === MAX_PROGRESS,
  )

  const earnedExtraTurn = match.diceValue === 6 && !playerFinished
  const nextPlayerIndex = earnedExtraTurn
    ? match.activePlayerIndex
    : (match.activePlayerIndex + 1) % PLAYERS.length

  const currentPlayerName = playersBySeat[currentPlayer.id].name
  const moveLabel =
    nextProgress === MAX_PROGRESS
      ? `${currentPlayerName} marched token ${tokenIndex + 1} home and finished it.`
      : `${currentPlayerName} moved token ${tokenIndex + 1} by ${match.diceValue} steps.`
  const captureLabel =
    capturedNames.length > 0 ? ` Captured ${capturedNames.join(' and ')} on the way.` : ''
  const turnLabel = earnedExtraTurn ? ' Extra turn earned.' : ''
  const winnerLabel = playerFinished
    ? match.mode === STAKED_MODE
      ? ` ${currentPlayerName} wins the ${match.prizePool}-coin pot.`
      : ` ${currentPlayerName} wins the free-play match.`
    : ''

  return {
    ...match,
    activePlayerIndex: nextPlayerIndex,
    diceValue: null,
    winnerId: playerFinished ? currentPlayer.id : null,
    tokensByPlayer,
    activity: [`${moveLabel}${captureLabel}${turnLabel}${winnerLabel}`, ...match.activity].slice(
      0,
      12,
    ),
  }
}
