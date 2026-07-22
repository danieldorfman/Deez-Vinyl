# Deez Vinyl
![Deez Vinyl Preview](preview.png)
A modern desktop Spotify player inspired by the warmth of vinyl records.

Deez Vinyl is a lightweight Electron application that turns Spotify playback into an immersive vinyl-inspired desktop experience, with animated artwork, dynamic backgrounds, and direct playback controls.

## Download

[Download the latest Windows installer](https://github.com/danieldorfman/Deez-Vinyl/releases/latest)

## Features

- Animated spinning vinyl record
- Live Spotify playback integration
- Dynamic album artwork and background
- Play, pause, next, previous, seek, volume, shuffle, and repeat controls
- Secure Spotify OAuth login with PKCE
- Encrypted local token storage through Electron `safeStorage`
- Like and unlike the current track
- Device selection and playback transfer
- Mini mode and always-on-top mode
- Optional Windows startup
- Windows installer and portable build scripts

## Requirements

- Windows 10 or Windows 11
- Node.js 20 or newer for development
- A Spotify account
- A Spotify developer application configured with:

```text
http://127.0.0.1:43821/callback
```

Some Spotify playback controls may require Spotify Premium.

## Development

```bash
npm install
npm start
```

Run source checks:

```bash
npm run check
```

Build the Windows installer:

```bash
npm run dist
```

Build the portable Windows executable:

```bash
npm run dist:portable
```

Build output is written to the `dist` directory.

## Spotify setup

1. Create an application in the Spotify Developer Dashboard.
2. Add `http://127.0.0.1:43821/callback` as an allowed redirect URI.
3. Launch Deez Vinyl.
4. Enter the application's Spotify Client ID.
5. Complete the Spotify authorization flow in the browser.

No Spotify client secret is required because Deez Vinyl uses Authorization Code with PKCE.

## Privacy

Spotify access and refresh tokens are stored only on the user's computer. When Windows encryption is available, Electron `safeStorage` is used to protect them. No tokens or personal Spotify data are included in this repository.

## License

Released under the [MIT License](LICENSE).

## Author

Created by Daniel Dorfman.
