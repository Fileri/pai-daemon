import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Version info
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
const VERSION = packageJson.version;
const BUILD_TIME = new Date().toISOString();

const PORT = process.env.PORT || 3000;
const MAX_EVENTS = 1000;
const LOKI_PUSH_URL = process.env.LOKI_PUSH_URL || "";

// Types
interface PAIEvent {
  id: string;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  client_name?: string;
  payload: Record<string, unknown>;
  timestamp: number;
  timestamp_local: string;
  received_at: number;
}

// In-memory event buffer (ring buffer)
const events: PAIEvent[] = [];
const wsClients = new Set<WebSocket>();

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function pushToLoki(event: PAIEvent): Promise<void> {
  if (!LOKI_PUSH_URL) return;

  const timestampNs = String(event.timestamp * 1_000_000);
  const logLine = JSON.stringify({
    id: event.id,
    source_app: event.source_app,
    session_id: event.session_id,
    hook_event_type: event.hook_event_type,
    payload: event.payload,
  });

  const lokiPayload = {
    streams: [{
      stream: {
        namespace: "pai",
        app: "pai-daemon",
        source_app: event.source_app,
        hook_event_type: event.hook_event_type,
      },
      values: [[timestampNs, logLine]],
    }],
  };

  try {
    const response = await fetch(LOKI_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lokiPayload),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`Loki push failed [${response.status}]: ${text.slice(0, 200)}`);
    }
  } catch (error) {
    console.error("Loki push error:", error);
  }
}

function addEvent(event: PAIEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.shift();
  }

  // Broadcast to all connected WebSocket clients
  const message = JSON.stringify({ type: "event", data: event });
  for (const client of wsClients) {
    try {
      client.send(message);
    } catch {
      wsClients.delete(client);
    }
  }

  // Fire-and-forget Loki push
  pushToLoki(event);
}

const server = Bun.serve({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        version: VERSION,
        uptime: process.uptime(),
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ready check endpoint
    if (url.pathname === "/ready") {
      return new Response(JSON.stringify({ ready: true, version: VERSION }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Version endpoint
    if (url.pathname === "/version") {
      return new Response(JSON.stringify({
        name: "pai-daemon",
        version: VERSION,
        buildTime: BUILD_TIME,
        runtime: "bun",
        runtimeVersion: Bun.version,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // POST /events - Ingest events
    if (url.pathname === "/events" && req.method === "POST") {
      try {
        const body = await req.json();
        const event: PAIEvent = {
          id: generateEventId(),
          source_app: body.source_app || "unknown",
          session_id: body.session_id || "unknown",
          hook_event_type: body.hook_event_type || "unknown",
          client_name: body.client_name || body.payload?.client_name,
          payload: body.payload || body,
          timestamp: body.timestamp || Date.now(),
          timestamp_local: body.timestamp_local || new Date().toISOString(),
          received_at: Date.now(),
        };

        addEvent(event);
        console.log(`[${event.timestamp_local}] ${event.hook_event_type} from ${event.source_app} (${event.session_id})`);

        return new Response(JSON.stringify({ ok: true, eventId: event.id }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Failed to parse event:", error);
        return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // GET /events - Query recent events
    if (url.pathname === "/events" && req.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const eventType = url.searchParams.get("type");
      const sessionId = url.searchParams.get("session");

      let filtered = events;
      if (eventType) {
        filtered = filtered.filter(e => e.hook_event_type === eventType);
      }
      if (sessionId) {
        filtered = filtered.filter(e => e.session_id === sessionId);
      }

      const result = filtered.slice(-limit);

      return new Response(JSON.stringify({ events: result, total: result.length }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /stats - Basic stats
    if (url.pathname === "/stats") {
      const stats = {
        totalEvents: events.length,
        wsClients: wsClients.size,
        eventTypes: {} as Record<string, number>,
        sessions: new Set(events.map(e => e.session_id)).size,
      };

      for (const event of events) {
        stats.eventTypes[event.hook_event_type] = (stats.eventTypes[event.hook_event_type] || 0) + 1;
      }

      return new Response(JSON.stringify(stats), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("PAI Daemon", { status: 200 });
  },

  websocket: {
    open(ws) {
      wsClients.add(ws);
      console.log(`WebSocket client connected (${wsClients.size} total)`);

      // Send recent events on connect
      ws.send(JSON.stringify({
        type: "init",
        data: {
          events: events.slice(-50),
          message: "Connected to PAI Daemon"
        }
      }));
    },

    close(ws) {
      wsClients.delete(ws);
      console.log(`WebSocket client disconnected (${wsClients.size} total)`);
    },

    message(ws, message) {
      // Handle ping/pong or future commands
      const data = JSON.parse(message.toString());
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    },
  },
});

console.log(`PAI Daemon v${VERSION} listening on port ${server.port}`);
console.log(`  GET  /version   - Version info`);
console.log(`  GET  /health    - Health check`);
console.log(`  POST /events    - Ingest events`);
console.log(`  GET  /events    - Query events`);
console.log(`  GET  /stats     - Event stats`);
console.log(`  WS   /ws        - Real-time stream`);
