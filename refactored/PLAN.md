# Teacher Tiles Refactoring
This is a plan to refactor the teacher-tiles project. The goal of the refactoring is to improve maintainability and modularity.

## Challenges
The main pain points of the existing project is:
1. A singular app.js file with over 10k lines of code
    - UI behavior
    - Backend calls
    - Cloud run function calls
    - Basically the entire core project in a single file
2. Revealing client-side info
    - Values in the browser cache or window object are prone to manipulation since it sits entirely on the client side
    - Values like TeacherTilesClassScope contain potentially exposing information like the UID directly from the database

## Propsed Patterns
1. Going with the modularity focus, there should be a separate directory called "services" that make the API calls. This is what the web components invoke. The services should exist outside of the tiles. Services include firebase calls, cloud function invocations, and stripe calls
2. Existing examples are the tiles, news, and changelog directories. They should each contain their own web component and UI behavior
3. Cloud invocations should exist in this project, but the definition of the functions themselves should exist and maintained separately as part of a different repo. This goes for the functions directory, the firestore.rules, firebase.json, .firebaserc, and any other firebase specific logic that applies to the backend architecture.

## Goal
Scan the codebase to create two artifacts:
1. The product owner perspective. Outlines the product use cases, edge cases, and user conditions. It should answer the questions:
    - How does the user want to use the product?
    - What kind of user will use the product?
    - What does each tile do? What are its limitations? What are its assumptions?
    - Identify the other behaviors within the application: Shop, customizations, settings, keystrokes, mousestrokes, interactions
2. The developer perspective. Without providing lengthy code snippets, how are the core behaviors achieved? What are some things that need to be carried over from the existing project to the refactored project 1:1? What things already have a lot of tech debt in the existing project and can be remediated in the refactoring?
