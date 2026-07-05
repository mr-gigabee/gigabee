import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
addEventListener("message", (msg) => handler.onmessage(msg as MessageEvent));
