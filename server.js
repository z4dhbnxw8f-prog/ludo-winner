import http from 'node:http'
import { randomUUID } from 'node:crypto'
import {
  DEFAULT_STAKE,
  FREE_MODE,
  PLAYERS,
  SHOP_PACKS,
  STAKED_MODE,
  applyMove,
  applyRoll,
  createInitialChat,
  createMatchState,
  createPlayerSeat,
} from './src/gameCore.js'

const PORT = Number(process.env.PORT || 3001)
const HOST = process.env.HOST || '127.0.0.1'
const rooms = new Map()
const streams = new Map()

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  response.end(JSON.stringify(payload))
}

function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''

  while (!code || rooms.has(code)) {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  }

  return code
}

function createRoom({ playerName, mode, stake, matchType }) {
  const roomCode = generateRoomCode()
  const hostToken = randomUUID()
  const playersBySeat = Object.fromEntries(
    PLAYERS.map((player, index) => [
      player.id,
      {
        ...createPlayerSeat(player, index === 0 ? playerName : ''),
        token: index === 0 ? hostToken : null,
      },
    ]),
  )

  const room = {
    roomCode,
    mode: mode || FREE_MODE,
    stake: Number(stake || DEFAULT_STAKE),
    matchType: matchType || '1v1',
    status: 'waiting',
    playersBySeat,
    chatMessages: createInitialChat(
      PLAYERS.map((player) => ({
        id: player.id,
        name: playersBySeat[player.id].name || player.defaultName,
      })),
      mode || FREE_MODE,
      Number(stake || DEFAULT_STAKE),
    ),
    nextChatId: 2,
    match: createMatchState(mode || FREE_MODE, Number(stake || DEFAULT_STAKE)),
  }

  playersBySeat.red.connected = true
  rooms.set(roomCode, room)

  return { room, hostToken }
}

function getSeatByToken(room, token) {
  return PLAYERS.find((player) => room.playersBySeat[player.id].token === token)?.id ?? null
}

function getRoomView(room, token) {
  const seat = getSeatByToken(room, token)

  return {
    roomCode: room.roomCode,
    status: room.status,
    mode: room.mode,
    stake: room.stake,
    matchType: room.matchType || '1v1',
    prizePool: room.match.prizePool,
    players: PLAYERS.map((player) => {
      const seatState = room.playersBySeat[player.id]
      return {
        seat: player.id,
        label: player.label,
        name: seatState.name || 'Waiting for player...',
        connected: seatState.connected,
        coins: seatState.coins,
        spentUsd: seatState.spentUsd,
        wins: seatState.wins ?? 0,
        joined: Boolean(seatState.token),
      }
    }),
    you: seat
      ? {
          seat,
          name: room.playersBySeat[seat].name,
          coins: room.playersBySeat[seat].coins,
          spentUsd: room.playersBySeat[seat].spentUsd,
        }
      : null,
    match: room.match,
    chatMessages: room.chatMessages,
  }
}

function broadcast(room) {
  const listeners = streams.get(room.roomCode) ?? new Set()

  listeners.forEach(({ response, token }) => {
    response.write(`data: ${JSON.stringify(getRoomView(room, token))}\n\n`)
  })
}

function addSystemMessage(room, text) {
  room.nextChatId += 1
  room.chatMessages.push({
    id: room.nextChatId,
    author: 'Table Bot',
    playerId: 'system',
    text,
  })
}

function maybeStartRoom(room) {
  const bothJoined = PLAYERS.every((player) => room.playersBySeat[player.id].token)

  if (!bothJoined) {
    room.status = 'waiting'
    return
  }

  if (room.mode === STAKED_MODE) {
    const canAfford = PLAYERS.every(
      (player) => room.playersBySeat[player.id].coins >= room.stake,
    )

    if (!canAfford) {
      addSystemMessage(room, 'A player does not have enough coins to post this stake.')
      return
    }

    PLAYERS.forEach((player) => {
      room.playersBySeat[player.id].coins -= room.stake
    })
  }

  room.match = createMatchState(room.mode, room.stake)
  room.status = 'ready'
  addSystemMessage(
    room,
    room.mode === FREE_MODE
      ? `Both players are here. The ${room.matchType || '1v1'} match is live.`
      : `Both players posted ${room.stake} coins. The ${room.match.prizePool}-coin pot is live.`,
  )
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function ensureRoom(response, roomCode) {
  const room = rooms.get(roomCode)

  if (!room) {
    sendJson(response, 404, { error: 'Room not found.' })
    return null
  }

  return room
}

function ensureSeat(response, room, token) {
  const seat = getSeatByToken(room, token)

  if (!seat) {
    sendJson(response, 403, { error: 'Invalid player token.' })
    return null
  }

  return seat
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: 'Missing URL.' })
    return
  }

  const url = new URL(request.url, `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/rooms') {
    const body = await readBody(request)
    const { room, hostToken } = createRoom(body)
    sendJson(response, 201, {
      playerToken: hostToken,
      room: getRoomView(room, hostToken),
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/rooms/join') {
    const body = await readBody(request)
    const room = ensureRoom(response, body.roomCode?.toUpperCase())

    if (!room) {
      return
    }

    const greenSeat = room.playersBySeat.green

    if (greenSeat.token) {
      sendJson(response, 409, { error: 'This room already has two players.' })
      return
    }

    greenSeat.token = randomUUID()
    greenSeat.name = body.playerName || 'Guest Challenger'
    greenSeat.connected = true
    maybeStartRoom(room)
    broadcast(room)
    sendJson(response, 200, {
      playerToken: greenSeat.token,
      room: getRoomView(room, greenSeat.token),
    })
    return
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/([a-z-]+))?$/)

  if (!roomMatch) {
    sendJson(response, 404, { error: 'Not found.' })
    return
  }

  const [, roomCode, action] = roomMatch
  const room = ensureRoom(response, roomCode)

  if (!room) {
    return
  }

  if (request.method === 'GET' && action === 'events') {
    const token = url.searchParams.get('token')
    const seat = ensureSeat(response, room, token)

    if (!seat) {
      return
    }

    room.playersBySeat[seat].connected = true

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    })

    response.write(`data: ${JSON.stringify(getRoomView(room, token))}\n\n`)

    const listener = { response, token }
    const roomListeners = streams.get(room.roomCode) ?? new Set()
    roomListeners.add(listener)
    streams.set(room.roomCode, roomListeners)

    request.on('close', () => {
      roomListeners.delete(listener)
      room.playersBySeat[seat].connected = false
      broadcast(room)
    })

    broadcast(room)
    return
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' })
    return
  }

  const body = await readBody(request)
  const seat = ensureSeat(response, room, body.token)

  if (!seat) {
    return
  }

  if (action === 'roll') {
    if (room.status !== 'ready') {
      sendJson(response, 409, { error: 'Waiting for both players.' })
      return
    }

    const activeSeat = PLAYERS[room.match.activePlayerIndex].id

    if (activeSeat !== seat) {
      sendJson(response, 403, { error: 'It is not your turn.' })
      return
    }

    room.match = applyRoll(room.match, room.playersBySeat)
    broadcast(room)
    sendJson(response, 200, { ok: true })
    return
  }

  if (action === 'move') {
    if (room.status !== 'ready') {
      sendJson(response, 409, { error: 'Waiting for both players.' })
      return
    }

    const previousWinner = room.match.winnerId
    room.match = applyMove(room.match, room.playersBySeat, seat, Number(body.tokenIndex))

    if (room.match.winnerId && room.match.winnerId !== previousWinner) {
      room.playersBySeat[room.match.winnerId].wins += 1
    }

    if (room.match.winnerId && room.mode === STAKED_MODE) {
      room.playersBySeat[room.match.winnerId].coins += room.match.prizePool
    }

    broadcast(room)
    sendJson(response, 200, { ok: true })
    return
  }

  if (action === 'chat') {
    const text = String(body.text || '').trim().slice(0, 280)

    if (!text) {
      sendJson(response, 400, { error: 'Message cannot be empty.' })
      return
    }

    room.nextChatId += 1
    room.chatMessages.push({
      id: room.nextChatId,
      author: room.playersBySeat[seat].name,
      playerId: seat,
      text,
    })
    broadcast(room)
    sendJson(response, 200, { ok: true })
    return
  }

  if (action === 'purchase') {
    const pack = SHOP_PACKS.find((entry) => entry.id === body.packId)

    if (!pack) {
      sendJson(response, 404, { error: 'Pack not found.' })
      return
    }

    const player = room.playersBySeat[seat]
    player.coins += pack.coins
    player.spentUsd = Number((player.spentUsd + Number.parseFloat(pack.price.slice(1))).toFixed(2))
    addSystemMessage(
      room,
      `${player.name} bought ${pack.label} for ${pack.price}. Replace this mock purchase with a real checkout backend.`,
    )
    broadcast(room)
    sendJson(response, 200, { ok: true })
    return
  }

  if (action === 'reset') {
    const bothJoined = PLAYERS.every((player) => room.playersBySeat[player.id].token)

    if (!bothJoined) {
      sendJson(response, 409, { error: 'Both players must be in the room to start a rematch.' })
      return
    }

    if (room.mode === STAKED_MODE) {
      const canAfford = PLAYERS.every(
        (player) => room.playersBySeat[player.id].coins >= room.stake,
      )

      if (!canAfford) {
        sendJson(response, 409, { error: 'A player cannot afford the rematch stake.' })
        return
      }

      PLAYERS.forEach((player) => {
        room.playersBySeat[player.id].coins -= room.stake
      })
    }

    room.match = createMatchState(room.mode, room.stake)
    room.status = 'ready'
    addSystemMessage(room, 'Rematch started.')
    broadcast(room)
    sendJson(response, 200, { ok: true })
    return
  }

  sendJson(response, 404, { error: 'Unknown action.' })
})

server.listen(PORT, HOST, () => {
  console.log(`Ludo server listening on http://${HOST}:${PORT}`)
})
