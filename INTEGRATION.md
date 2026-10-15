# Proposed start.ng host adapter

The public game is a playable guest demo. Publishing it on GitHub does **not** complete the assignment's start.ng deployment, authenticated-player, or central-styling requirements.

## Host responsibilities

1. Authenticate the player using the platform's existing session.
2. Obtain the central character appearance from the platform's real source of truth.
3. Send only the display identity and appearance below to the embedded game. Keep JWTs and cookies in the host; do not send credentials in iframe URLs or messages.
4. Re-send the session payload when the central appearance changes.

## Proposed iframe contract

The game emits `{ type: 'skyline:ready', version: 1 }` to supported parent origins. After verifying the message origin and source, the host can send:

```js
const gameOrigin = 'https://timoty-a.github.io';
const iframe = document.querySelector('#skyline-game');

// Use actual platform data, not these example values.
iframe.contentWindow.postMessage({
  type: 'startng:session',
  session: {
    user: { id: 'platform-user-id', name: 'Player display name' },
    appearance: { primaryColor: '#83cbe9' }
  }
}, gameOrigin);
```

Accepted parent origins are `https://start.ng`, `https://www.start.ng`, and the team frontend's local origin `http://localhost:5173`. Messages must come from the actual parent window. Add a staging origin explicitly after the team confirms it; do not use a wildcard receiver.

The game displays the supplied player name and applies `primaryColor` to the runner's shirt, sleeves, and backpack accents. Colours must be six-digit hex values. The identity is presentation data only, not an authorization check or proof of authentication.

If the game is imported directly into the platform's page, call:

```js
window.SkylineRush.setSession({
  user: authenticatedUser,
  appearance: { primaryColor: centralAppearance.primaryColor }
});
```

A copy of the current presentation session is available via `window.SkylineRush.getSession()`.

## Team checklist

- [ ] Confirm how start.ng registers, embeds, and publishes games.
- [ ] Confirm the official central appearance schema and API.
- [ ] Have the authenticated host send the real user's presentation data.
- [ ] Confirm changing central appearance updates this game's runner.
- [ ] Publish the game on start.ng and verify the deployed integration.
- [ ] Record the required test video with the team repository URL visible.
- [ ] Follow the team PR and central staging submission requirements.
