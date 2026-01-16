# PAI Daemon

Event bus for Personal AI Infrastructure. Collects telemetry from Claude Code sessions and enables real-time monitoring.

## Quick Start

```bash
bun install
bun run dev
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /events` | Ingest events |
| `WS /ws` | Real-time event stream |
| `GET /health` | Liveness probe |
| `GET /ready` | Readiness probe |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and API reference
- [Events](docs/EVENTS.md) - Event types and schemas

## Deployment

Deployed to HomeLab Kubernetes cluster via FluxCD. See `k8s/` for manifests.
