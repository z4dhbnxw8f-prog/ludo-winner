# Ludo Winner

A Vite + React multiplayer-ready Ludo prototype with:

- a 4-player board
- turn-based dice rolls
- token movement and captures
- free-play and coin-staked tables
- a mock real-money coin shop
- a match activity feed
- an in-room chat box

## Run locally

```bash
npm install
npm run dev
```

## What is included

- Local multiplayer on one device for 4 players
- Editable player names
- Free mode that always stays available
- Coin table setup with configurable stakes and winner payout
- Mock shop purchases that top up in-game currency balances
- Ludo movement rules for leaving home, entering the lane, and finishing tokens
- Capture handling on non-safe tiles
- A polished responsive UI

## Good next steps for true online multiplayer

- Add Socket.IO or Supabase Realtime for synchronized turns and chat
- Move match state into a backend room store
- Add authentication and room codes
- Replace mock coin purchases with a real payment processor and server-side wallet ledger
- Persist chat history and finished games
