const fs = require("fs");
const path = require("path");

const env = process.env;
const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_MEASUREMENT_ID"
];
const missing = required.filter((key) => !env[key]);
if (missing.length) {
  console.error("Missing Firebase env vars:", missing.join(", "));
  process.exit(1);
}

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

const outPath = path.resolve(__dirname, "firebase-config.js");
const contents = `window.firebaseConfig = ${JSON.stringify(config, null, 2)};\n`;
fs.writeFileSync(outPath, contents, "utf8");
console.log(`Wrote Firebase config to ${outPath}`);
