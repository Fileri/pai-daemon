# PAI Daemon

Event bus for PAI observability. Runs in Kubernetes cluster.

## Release Process (IMPORTANT)

When updating this codebase, follow this process to deploy:

1. **Update version** in `package.json`
2. **Commit** your changes
3. **Create git tag** matching the version: `git tag v0.2.x`
4. **Push commits and tag**: `git push && git push --tags`
5. **Update `k8s/deployment.yaml`** with new image tag
6. **Commit and push** the deployment change

GitHub Actions builds on tag push. GitOps deploys when k8s/ changes.

**Verify**: `curl -s https://pai-daemon.tail848835.ts.net/version`

## Key Files

| File | Purpose |
|------|---------|
| `src/server.ts` | Main server with all endpoints |
| `package.json` | Version number lives here |
| `k8s/deployment.yaml` | Image tag for deployment |

## Endpoints

- `GET /version` - Version info
- `GET /health` - Health check
- `POST /events` - Ingest events
- `GET /events` - Query events
- `WS /ws` - Real-time stream
