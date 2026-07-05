import { Buffer } from "buffer";
// Polyfill Buffer for @solana/web3.js and @solana/spl-token in browser
Object.assign(globalThis, { Buffer });

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
