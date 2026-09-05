# Fish Tank

Uses the user's supplied PNG sprites in `assets/`. The microphone starts only from the tile's Enable microphone button; audio is analyzed locally and is never connected to speakers, recorded, or sent anywhere. Turning it off, deleting the tile, or hiding the browser tab releases the stream. Restoring a board never automatically turns the microphone on.

The sound level uses the same relative RMS-to-percent mapping as the existing Noise Meter. Threshold and sensitivity can be adjusted for the room. Sustained loudness scares the fish and resets the quiet streak; short spikes are ignored. Quiet periods invite fish every eight seconds, up to eighteen. Tuna unlock at 30 seconds, pufferfish at 60, tilapia at 90, anglerfish at 120, and sharks at 180. A rare visitor can replace a common fish in a full tank.

Feed the fish using the button or by clicking in the tank. Food and animation work with the microphone off. Hidden/offscreen tanks stop rendering. Board state stores species and sound settings, not microphone access or audio.

Run `node tiles/fish-tank/tests.cjs` for sound-response and rarity checks.
