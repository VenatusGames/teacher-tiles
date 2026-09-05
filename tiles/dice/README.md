# Dice

Click a die or Roll dice to roll all active dice. Add/remove controls support one to four dice; the result shows their sum. Uses Web Crypto with rejection sampling to avoid modulo bias. Rolled values persist in board state.

No Background is a 250-coin skin in Shop → Tile Skins, registered in the server product catalog. After purchase it appears as owned in the Tile Skins shelf. Choose it there as the default Dice skin or place it from the shelf. Its controls fade when the tile is not hovered or focused. Reduced-motion preferences disable tumbling.

Run `node tiles/dice/tests.cjs` for the random-number mapping checks.

Dice automatically choose rows and columns that maximize their square size within the available area. Pips scale with each die. The title uses the shared double-click heading editor and persists with the board.
