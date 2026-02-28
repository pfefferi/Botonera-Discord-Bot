# Lessons Learned

## 2026-02-28
- **Deployment Strategy**: Initially planned to split hosting (GitHub pages for frontend, separate server for bot). Pivoted to a consolidated approach where the Node.js Express server serving the bot also serves the static frontend files. This simplifies deployment to a single platform like Render and reduces CORS/domain configuration complexity.
- **Audio Routing**: Discord Bot audio requires `libsodium-wrappers` and `ffmpeg-static` to stream local files correctly into voice channels.
