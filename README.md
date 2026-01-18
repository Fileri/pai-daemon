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

## Public Endpoint

```
https://pai-daemon.tail848835.ts.net
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and API reference
- [Events](docs/EVENTS.md) - Event types and schemas
- [Tailscale Funnel](docs/TAILSCALE-FUNNEL.md) - Public ingress setup

## Deployment

Deployed to HomeLab Kubernetes cluster. Exposed publicly via Tailscale Funnel.

See `k8s/` for manifests.

## Releasing a New Version

1. **Update version** in `package.json`:
   ```bash
   # Edit package.json: "version": "0.2.2"
   ```

2. **Commit changes**:
   ```bash
   git add -A
   git commit -m "feat: description of changes"
   ```

3. **Create git tag** with `v` prefix:
   ```bash
   git tag v0.2.2
   ```

4. **Push commits and tag**:
   ```bash
   git push && git push --tags
   ```

5. **Update deployment** (note: image tag has NO `v` prefix):
   ```bash
   # Edit k8s/deployment.yaml: image: ghcr.io/fileri/pai-daemon:0.2.2
   git add -A
   git commit -m "chore: deploy 0.2.2"
   git push
   ```

GitHub Actions builds on tag push. Docker metadata strips `v` prefix from image tags.
GitOps deploys when k8s/ changes.

**Verify deployment**:
```bash
curl -s https://pai-daemon.tail848835.ts.net/version | jq .version
```
