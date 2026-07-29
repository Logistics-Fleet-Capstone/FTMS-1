# API contracts

## `GET /api/health/`

Implemented readiness endpoint. It performs a lightweight database query.

Successful response (`200 OK`):

```json
{
  "status": "ok",
  "service": "ftms-backend",
  "database": "ok"
}
```

Unavailable database response (`503 Service Unavailable`):

```json
{
  "status": "error",
  "service": "ftms-backend",
  "database": "unavailable"
}
```

The response intentionally excludes credentials, environment values, internal hostnames, and stack traces.

## `POST /api/v1/telemetry/`

Accepts the strict telemetry `1.0` payload documented in
`docs/telemetry-contract-v1.md`.

- `201 Created`: a new append-only event was stored (`created: true`, `duplicate: false`).
- `200 OK`: the same event ID and semantically identical data already exist
  (`created: false`, `duplicate: true`).
- `409 Conflict`: the event ID already exists with different semantic data. The accepted
  row is never modified.
- `400 Bad Request`: schema, vehicle, timestamp, coordinate, range, or enum validation failed.

The success body contains canonical UTC timestamps and normalized numeric telemetry under
`event`.

## `GET /api/v1/vehicles/{device_id}/latest-status/`

Returns pilot vehicle identity and `latest`, which is either the newest event or `null`.
Latest means observation time (`recorded_at`) first, then sequence number, server receipt
time, and primary key as deterministic tie-breakers. A late-arriving older observation
therefore cannot replace the current status.

Unknown devices return `404 Not Found`. There are no update or delete telemetry endpoints.
