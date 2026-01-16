# Tailscale Funnel Setup

pai-daemon is exposed publicly via Tailscale Funnel, eliminating the need for traditional ingress controllers, cert-manager, or DNS management.

## Public Endpoint

```
https://pai-daemon.tail848835.ts.net
```

## Architecture

```
Internet
    │
    ▼
Tailscale Funnel (176.58.88.82)
    │
    ▼
Tailscale Proxy Pod (ts-pai-daemon-funnel-*)
    │
    ▼
pai-daemon Service (ClusterIP)
    │
    ▼
pai-daemon Pod
```

## Prerequisites

### 1. Tailscale ACL Configuration

Add to https://login.tailscale.com/admin/acls:

```json
{
  "tagOwners": {
    "tag:k8s": ["autogroup:admin"]
  },
  "nodeAttrs": [
    {
      "target": ["tag:k8s"],
      "attr": ["funnel"]
    }
  ]
}
```

### 2. Enable HTTPS for Tailnet

Go to https://login.tailscale.com/admin/dns and enable **HTTPS Certificates**.

### 3. OAuth Client

Create at https://login.tailscale.com/admin/settings/oauth:
- **Name:** `homelab-k8s-operator`
- **Scopes:** Core (write), Auth Keys (write)
- **Tag:** `tag:k8s`

Credentials stored in 1Password as `Tailscale-K8s-Operator-OAuth`.

## Kubernetes Resources

### Tailscale Operator (tailscale namespace)

Installed via Helm:

```bash
helm upgrade --install tailscale-operator tailscale/tailscale-operator \
  --namespace tailscale \
  --set oauth.clientId=<CLIENT_ID> \
  --set oauth.clientSecret=<CLIENT_SECRET> \
  --set operatorConfig.defaultTags='{tag:k8s}'
```

The namespace requires privileged pod security:

```bash
kubectl label namespace tailscale pod-security.kubernetes.io/enforce=privileged
```

### Funnel Ingress (pai namespace)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pai-daemon-funnel
  namespace: pai
  annotations:
    tailscale.com/funnel: "true"
spec:
  ingressClassName: tailscale
  defaultBackend:
    service:
      name: pai-daemon
      port:
        number: 80
  tls:
  - hosts:
    - pai-daemon
```

## Verification

Check Funnel status from the proxy pod:

```bash
kubectl -n tailscale exec <proxy-pod> -c tailscale -- tailscale funnel status
```

Expected output:
```
# Funnel on:
#     - https://pai-daemon.tail848835.ts.net

https://pai-daemon.tail848835.ts.net (Funnel on)
|-- / proxy http://10.110.216.224:80/
```

Test the endpoint:

```bash
curl https://pai-daemon.tail848835.ts.net/health
# {"status":"ok"}
```

## Benefits Over Traditional Ingress

| Aspect | nginx + cert-manager | Tailscale Funnel |
|--------|---------------------|------------------|
| TLS Certificates | Manual (Let's Encrypt) | Automatic |
| DNS Records | Required | Not needed |
| Public IP | Required | Not needed |
| Firewall Rules | Required | Not needed |
| Setup Complexity | High | Low |

## Troubleshooting

### DNS not resolving

Tailscale manages DNS for `*.ts.net` domains. If DNS isn't working:
1. Wait a few minutes for propagation
2. Flush local DNS cache: `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder`

### Funnel not enabled

Check that:
1. HTTPS is enabled for the tailnet
2. `nodeAttrs` includes Funnel permission for `tag:k8s`
3. The proxy pod has restarted after ACL changes

### Proxy pod not starting

Ensure the `tailscale` namespace has privileged pod security:

```bash
kubectl label namespace tailscale pod-security.kubernetes.io/enforce=privileged --overwrite
```
