# TeacherTiles homepage

The reviewed homepage source lives here. Main builds install this page at the site root; dev builds keep the protected developer portal and expose this page at /dev/home.html.

Board links, the Add Tile catalog source, and the shared catalog reader resolve within the current deployment. The tile strip and searchable library refresh from the current board menu, with catalog-fallback.json available if the live source cannot load.

Native demonstrations remain isolated and memory-only; they reset after 20 seconds out of view. The review-only banner, approval dialog, and local preview launcher are not part of this deployment. Reduced-motion preferences disable decorative motion; highlighted headings sweep into view during normal motion.

Contact: teachertiles@gmail.com. The form submits through the Firebase `contactEmail` endpoint, including school, role, and interest details in the message.
