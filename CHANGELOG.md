# Changelog

## [1.1.0] - 2026-02-28
### Added
- Categorized sound tabs for Sonic and Shadow.
- Integrated folder-aware playback in both frontend and backend.
- Premium tabbed navigation UI with glassmorphism styling.
### Fixed
- Handling of `files.json` as a categorized object instead of a flat array.
- CSS compatibility lints for `background-clip` and `appearance`.

## [1.0.0] - 2026-02-28
### Added
- Initial creation of the Botonera Web App.
- Created premium grid-based glassmorphic UI.
- Created Node script `generate_file_list.js` to create static catalogue of sounds.
- Bootstrapped Discord Bot backend in `bot/index.js` using `discord.js`.
- Configured Express server to serve the frontend web-app statically and listen to API calls on `/play` and `/stop`.
- Initialized local git repository for deployment.
