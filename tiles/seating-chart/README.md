# Seating Chart

Starts with the shared saved-class picker, then shows the selected class and a Change class control. Roster updates refresh names while preserving the desk layout. Supports up to 80 desks, row/group/horseshoe arrangements, round tables and a teacher desk. Drag furniture or use arrow keys (Shift for larger steps). Select a desk to change its student, rotate it, remove it, or keep its assignment fixed during randomization. Furniture and Layout have dedicated bottom buttons; color and font controls use the board's shared helpers.

Saved board state includes the class ID and label, student names, desk coordinates, rotation, furniture type and locked assignments. Legacy charts with embedded names remain supported. Each class also keeps its own seating layout in the existing account-scoped class cache and batched encrypted class sync. Student roster names are not modified. Loading a class restores its latest saved layout, including an intentionally cleared room. Reset Layout restores the class to its default student desks in rows, removing extra furniture and assignment locks. Text is rendered with `textContent` and saved input is bounded and validated.

Run `node tiles/seating-chart/tests.cjs` for layout and roster-preservation checks.

Clear chart, in the gear menu, removes all desks and furniture and clears the selection while keeping the loaded class and roster. The empty layout is saved with the board.

Run `node scripts/seating-chart.test.cjs` for browser checks of class switching, reopening, board restoration, reset, account isolation, and encrypted-save batching.


Furniture opens a side drawer with student desks, teacher desks, and large, round, square, crescent, and trapezoid tables. Drag furniture into the room, or click/press Enter to add it to an available spot. Only student desks receive roster assignments. Layout offers Rows, Groups of Four, and Horseshoe without moving furniture. Objects snap along nearby edges and alignment guides; hold Alt to bypass snapping. Clicking outside the selected object (except its editing controls) clears selection. Per-class and board saves retain furniture types, positions, and rotations.
