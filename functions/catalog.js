"use strict";

const COIN_PACKS = Object.freeze({
  "coins-500": Object.freeze({ coins: 500, unitAmount: 499, name: "500 TeacherTiles Coins" }),
  "coins-1200": Object.freeze({ coins: 1200, unitAmount: 999, name: "1,200 TeacherTiles Coins" }),
  "coins-2600": Object.freeze({ coins: 2600, unitAmount: 1999, name: "2,600 TeacherTiles Coins" }),
  "coins-7000": Object.freeze({ coins: 7000, unitAmount: 4999, name: "7,000 TeacherTiles Coins" })
});

const COSMETIC_PRODUCTS = Object.freeze({
  "theme-pastel": Object.freeze({ price: 250, name: "Pastel Theme Pack" }),
  "theme-polka-dot": Object.freeze({ price: 250, name: "Polka Dot Theme Pack" }),
  "theme-programmer": Object.freeze({ price: 300, name: "Programmer Theme Pack" }),
  "theme-wood": Object.freeze({ price: 350, name: "Wood Theme Pack" }),
  "theme-notebook": Object.freeze({ price: 250, name: "Notebook Theme Pack" }),
  "theme-cardboard": Object.freeze({ price: 300, name: "Cardboard Theme Pack" }),
  "theme-metal": Object.freeze({ price: 350, name: "Metal Theme Pack" }),
  "theme-cosmos": Object.freeze({ price: 400, name: "Cosmos Theme Pack" }),
  "theme-corkboard": Object.freeze({ price: 300, name: "Corkboard Theme Pack" }),
  "sticker-emoji": Object.freeze({ price: 180, name: "Emoji Sticker Pack" }),
  "sticker-nature-emojis": Object.freeze({ price: 180, name: "Nature Emojis Sticker Pack" }),
  "sticker-animal-emojis": Object.freeze({ price: 180, name: "Animal Emojis Sticker Pack" }),
  "sticker-more-faces": Object.freeze({ price: 180, name: "More Faces Sticker Pack" }),
  "sticker-symbols": Object.freeze({ price: 180, name: "Symbols Sticker Pack" }),
  "sticker-food": Object.freeze({ price: 180, name: "Food Sticker Pack" }),
  "sticker-colored-hearts": Object.freeze({ price: 180, name: "Colored Hearts Sticker Pack" }),
  "sticker-decorative-hearts": Object.freeze({ price: 180, name: "Decorative Hearts Sticker Pack" }),
  "sticker-country-flags": Object.freeze({ price: 250, name: "Country Flags Sticker Pack" }),
  "tile-skin-magnifier-classic": Object.freeze({ price: 250, name: "Classic Magnifying Glass" }),
  "tile-skin-youtube-retro-tv": Object.freeze({ price: 300, name: "Vintage Television" }),
  "tile-skin-todo-clipboard": Object.freeze({ price: 250, name: "Classroom Clipboard" }),
  "tile-skin-calendar-paper-stack": Object.freeze({ price: 300, name: "Page-Stack Calendar" }),
  "tile-skin-attendance-beehive": Object.freeze({ price: 300, name: "Beehive Attendance" }),
  "tile-skin-attendance-monkeys": Object.freeze({ price: 300, name: "Monkeys Attendance" }),
  "tile-skin-attendance-froggies": Object.freeze({ price: 300, name: "Froggies Attendance" }),
  "tile-skin-attendance-bubble-tea": Object.freeze({ price: 300, name: "Bubble Tea Attendance" }),
  "tile-skin-stoplight-freestanding": Object.freeze({ price: 250, name: "Freestanding Stoplight" }),
  "tile-skin-stoplight-simplistic": Object.freeze({ price: 250, name: "Simplistic Stoplight" }),
  "tile-skin-progressbar-capsule": Object.freeze({ price: 250, name: "Floating Progress Capsule" }),
  "tile-skin-timer-freestanding": Object.freeze({ price: 250, name: "Freestanding Visual Timer" })
});

module.exports = { COIN_PACKS, COSMETIC_PRODUCTS };
