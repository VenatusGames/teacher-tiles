# Seating Chart

Starts with the shared saved-class picker, then shows the selected class and a Change class control. Roster updates refresh names while preserving the desk layout. Supports up to 80 desks, row/group/horseshoe arrangements, round tables and a teacher desk. Drag furniture or use arrow keys (Shift for larger steps). Select a desk to change its student, rotate it, remove it, or keep its assignment fixed during randomization. Layout and furniture controls live in the gear menu; color and font controls use the board's shared helpers.

Saved board state includes the class ID and label, student names, desk coordinates, rotation, furniture type and locked assignments. Legacy charts with embedded names remain supported. The tile does not modify the source class roster. Text is rendered with `textContent` and saved input is bounded and validated.

Run `node tiles/seating-chart/tests.cjs` for layout and roster-preservation checks.
