const PORT = process.env.PORT || 3000;

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ready check endpoint
    if (url.pathname === "/ready") {
      return new Response(JSON.stringify({ ready: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // TODO: Add API endpoints for n8n integration
    // TODO: Add session management
    // TODO: Add task execution

    return new Response("PAI Daemon", { status: 200 });
  },
});

console.log(`PAI Daemon listening on port ${server.port}`);
