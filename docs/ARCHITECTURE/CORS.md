# CORS Setup (Dev: Express, Prod: Nginx)

## Overview
- Dev: Express handles CORS locally.
- Prod: Nginx handles CORS for `https://api.zettaz.com`.
- Custom headers allowed: `x-store-id`, `store-id`, `x-tenant-id`, `tenant-id`, `x-request-id`.
- Credentials required: frontend uses `credentials: 'include'` in `fetch`.

## Frontend Configuration
- Local dev file: `frontend/.env.development.local`
```dotenv
VITE_API_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001
```
- Production (`frontend/.env.production`):
```dotenv
VITE_API_URL=https://api.zettaz.com
VITE_API_BASE_URL=https://api.zettaz.com
```

### Endpoint formatting (important)
- Do NOT include '/api' in `VITE_API_BASE_URL`. Use only the origin (e.g., `https://api.zettaz.com`).
- Prefer endpoints without '/api' (e.g., `'/products'` not `'/api/products'`).
- The client utility `buildApiUrl` in `frontend/src/services/api.ts` ensures exactly one '/api' prefix at runtime.

## Backend (Express) Configuration
- Enable in dev only:
  - `ENABLE_EXPRESS_CORS=true`
  - `ALLOW_LOCAL_DEV_ORIGIN=true`
- Disable in prod (Nginx will handle CORS):
  - `ENABLE_EXPRESS_CORS=false`
- Allowed origins resolved from `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, and local dev origins when allowed.

## Nginx (Production) Configuration
- Whitelist origins:
  - `https://cloud.zettaz.com` (prod)
  - `http://localhost:5173` (local dev)
- Echo `Access-Control-Allow-Origin: $http_origin` for credentials.
- Include `Vary: Origin` and set `always`.
- Include custom headers: `content-type, authorization, x-request-id, x-tenant-id, tenant-id, x-store-id, store-id`.
- Return 204 for `OPTIONS`.
- See `docs/11-developer-guidelines/nginx-cors.conf`.

## Testing (Preflight)
- Local dev → prod API:
```bash
curl -i -X OPTIONS https://api.zettaz.com/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type, authorization, x-store-id, x-tenant-id, x-request-id"
```

- Local dev → local API:
```bash
curl -i -X OPTIONS http://localhost:3001/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type, authorization, x-store-id, x-tenant-id, x-request-id"
```

Expected:
- 204 response.
- `Access-Control-Allow-Origin` echoes your Origin.
- `Access-Control-Allow-Credentials: true`.
- `Access-Control-Allow-Headers` includes all required headers.
- `Vary: Origin` present.

## Troubleshooting
- If preflight fails from local dev to prod:
  - Confirm Nginx config deployed and reloaded (`nginx -t` then reload).
  - Verify `Access-Control-Allow-Headers` includes `x-store-id` and `x-request-id`.
  - Ensure `Access-Control-Allow-Origin` is not `*` (must echo origin when using credentials).
- If local dev fails against local backend:
  - Confirm Express CORS is enabled in dev and `ALLOW_LOCAL_DEV_ORIGIN=true`.

## Notes
- Header names are case-insensitive per spec, but returning them in lower-case aligns with browsers' Access-Control-Request-Headers.
- Consider exposing response headers you need to read from JS using `Access-Control-Expose-Headers` (e.g., `x-request-id`).
