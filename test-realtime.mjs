import WebSocket from "ws";

const API_KEY = "sk-aRt4ew2R_UM4ewX9TMpMpw"; // paste your real key
const MODEL = "openai/gpt-realtime-2";

const urlsToTry = [
  `wss://genai-sharedservice-emea.pwcinternal.com/v1/realtime?model=${encodeURIComponent(MODEL)}`,
  `wss://genai-sharedservice-emea.pwcinternal.com/realtime?model=${encodeURIComponent(MODEL)}`,
];

const headerVariants = [
  { name: "Authorization Bearer", headers: { Authorization: `Bearer ${API_KEY}` } },
  { name: "api-key", headers: { "api-key": API_KEY } },
];

async function testConnection(url, headerVariant) {
  return new Promise((resolve) => {
    console.log(`\n--- Trying: ${url}`);
    console.log(`--- Headers: ${headerVariant.name}`);

    const ws = new WebSocket(url, { headers: headerVariant.headers });

    const timeout = setTimeout(() => {
      console.log("TIMEOUT — no response after 8s");
      ws.terminate();
      resolve();
    }, 8000);

    ws.on("open", () => {
      console.log("✅ SUCCESS — connection opened!");
      clearTimeout(timeout);
      ws.close();
      resolve();
    });

    ws.on("unexpected-response", (req, res) => {
      console.log(`❌ Unexpected response: ${res.statusCode} ${res.statusMessage}`);
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        console.log("Body:", body);
        clearTimeout(timeout);
        resolve();
      });
    });

    ws.on("error", (err) => {
      console.log("❌ Error:", err.message);
      clearTimeout(timeout);
      resolve();
    });
  });
}

for (const url of urlsToTry) {
  for (const headerVariant of headerVariants) {
    await testConnection(url, headerVariant);
  }
}
