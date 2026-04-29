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

## Test on two devices

1. Run `npm run dev` on your computer.
2. On device one, open the Vite URL and create a room.
3. On device two, open `http://YOUR_COMPUTER_IP:5173`.
4. Enter the room code from device one.

Both devices will stay synchronized for moves, chat, room status, and mock purchases.

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
