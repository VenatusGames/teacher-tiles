# Seating Chart

Loads saved classes through the shared roster loader, or accepts a pasted list of names. Supports up to 80 desks, row/group/horseshoe arrangements, round tables and a teacher desk. Drag furniture or use arrow keys (Shift for larger steps). Select a desk to change its student, rotate it, remove it, or keep its assignment fixed during randomization.

Saved board state includes the class label, student names, desk coordinates, rotation, furniture type and locked assignments. The tile does not modify the source class roster. Text is rendered with `textContent` and saved input is bounded and validated.

Run `node tiles/seating-chart/tests.cjs` for layout and roster-preservation checks.
