# Ludo Winner

A Vite + React 2-player Ludo app with:

- real-time room codes for two devices
- live match synchronization through a built-in Node room server
- turn-based dice rolls, token movement, captures, and chat
- free-play rooms and coin-staked rooms
- a mock in-room coin shop

## Run locally

```bash
npm install
npm run dev
```

That starts:

- the Vite client on `http://localhost:5173`
- the room server on `http://localhost:3001`

## Test on one laptop

1. Run `npm run dev` on your computer.
2. Open `http://localhost:5173` in one browser window or tab and create a room.
3. Open a second tab or a second window on the same laptop and visit `http://localhost:5173`.
4. Enter the room code from the first tab.

Both tabs will stay synchronized for moves, chat, room status, and mock purchases. This setup is intentionally designed for same-laptop local play only.

## What is included

- 2-player multiplayer with room codes
- Red vs Green seat assignment
- Live SSE room updates from the Node server
- Free mode that always stays available
- Coin room setup with winner payout
- Mock shop purchases that sync across devices

## Next steps for production

- Replace the in-memory room server with a persistent backend
- Replace mock purchases with Stripe, Paystack, Flutterwave, or another payment backend
- Add authentication and reconnect-safe player identity
- Add real deployment hosting for the API and frontend
