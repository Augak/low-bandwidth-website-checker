import { createWebServer } from "./server.js";
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
const server = createWebServer();
server.on("error", error => { console.error(`Could not start interface: ${error.message}`); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`Checker ready at http://127.0.0.1:${port}`));
