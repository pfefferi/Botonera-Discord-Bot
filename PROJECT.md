# Botonera

A premium Web Soundboard and Discord Bot.

## Overview
This project contains a sleek web interface (HTML/CSS/JS) to play sounds, integrated with a Node.js Express server and a Discord Bot (`discord.js`). When a button on the soundboard is clicked, a request is sent to the Express server, which prompts the Discord Bot to play the corresponding audio file in a connected voice channel.

## Tech Stack
- Frontend: HTML5, CSS3 (Custom Glassmorphism styling), Vanilla JavaScript
- Backend: Node.js, Express, `discord.js`, `@discordjs/voice`, `libsodium-wrappers`, `ffmpeg-static`
- Hosting: The Node server serves both the Discord bot and the static website files.

## Roadmap
- [x] Create Aesthetic UI for Soundboard
- [x] Generate dynamic list of audio files
- [x] Create Discord bot backend integration
- [x] Serve frontend from backend server
- [ ] Deploy to Render
