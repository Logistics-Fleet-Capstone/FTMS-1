# Sprint 4: Transport Request intake and approval

Sprint 4 adds one bounded Django module, `transport_requests`, to the existing modular monolith. It persists intake, approval state, PostGIS coordinates, and an append-only audit history. React continues to use credentialed Django session/CSRF requests; it never accesses PostgreSQL directly.

## Data and request numbers

`TransportRequest` owns intake fields only. Vehicle/driver assignment, trips, telemetry, cost, proof of service, safety scoring, and recommendations are deliberately absent. Optional coordinates are GeoDjango `Point` values in longitude/latitude order with SRID 4326. Datetimes are accepted with an explicit offset, stored in UTC, and displayed by the workspace in Asia/Manila time.

Visible numbers use `TR-YYMMDD-####`. A unique row per date is locked and incremented inside the creation transaction, rather than using `count() + 1`; the number is unique and immutable. Each creation and successful transition writes exactly one `TransportRequestStatusHistory` row in the same transaction.

## Workflow

```text
SUBMITTED -> PENDING_APPROVAL -> APPROVED
                |            -> REJECTED
                +-> MORE_DETAILS_REQUIRED -> PENDING_APPROVAL
SUBMITTED or MORE_DETAILS_REQUIRED -> CANCELLED
```

Invalid or stale transitions return `409 Conflict`. Reject and request-details require a non-empty `remarks` JSON field. Generic PATCH cannot change the request number, status, creator, or timestamps.

## RBAC

| Capability | SUPER_ADMIN | FLEET_MANAGER | DISPATCHER |
|---|---:|---:|---:|
| List, retrieve, history | Yes | Yes | Yes |
| Create and edit intake | Yes | Yes | No |
| Submit, approve, reject, request details, resubmit, cancel | Yes | Yes | No |

Anonymous users receive `401`; non-staff and staff without an approved profile receive `403`. Backend authorization is authoritative even when React hides a control.

## API

- `GET|POST /api/v1/transport-requests/`
- `GET|PATCH /api/v1/transport-requests/{request_number}/`
- `POST .../{submit|approve|resubmit|cancel}/`
- `POST .../reject/` with `{ "remarks": "Vehicle capacity unavailable" }`
- `POST .../request-details/` with `{ "remarks": "Confirm passenger count" }`
- `GET .../history/`

List parameters are `page`, `page_size` (maximum 100), `search`, `status`, `priority`, `request_type`, `scheduled_from`, `scheduled_to`, and `ordering`. Search covers number, requester, both addresses, and external reference. Status accepts comma-separated supported statuses.

Example creation request:

```json
{
  "request_type": "AIRPORT_PICKUP",
  "requester_name": "Maria Santos",
  "source_system": "HOTEL_OPERATIONS",
  "external_reference": "HOTEL-2026-1004",
  "pickup_address": "NAIA Terminal 3",
  "pickup_location": {"longitude": 121.0138, "latitude": 14.5196},
  "destination_address": "Oxford Suites Makati",
  "destination_location": {"longitude": 121.0286, "latitude": 14.5631},
  "scheduled_at": "2026-08-04T09:30:00+08:00",
  "priority": "HIGH",
  "passenger_count": 2,
  "required_vehicle_type": "SEDAN",
  "special_instructions": "Meet at arrivals."
}
```

Responses add `request_number`, `status`, `created_by`, `created_at`, and `updated_at`; internal UUIDs are not exposed.

## Local development and seed data

Run migrations against PostGIS, then create a permitted staff user and run:

```bash
python manage.py migrate
python manage.py seed_transport_requests --username admin
```

The command is idempotent by stable external references and labels every record as simulated pilot data. Running it twice creates no duplicates. No new secret is required. `VITE_GOOGLE_MAPS_API_KEY` remains optional and must only be placed in a local ignored `.env`; the UI shows a fallback when absent.

## Frontend scope and limitations

Requests, approval, and the approved/awaiting-assignment queue use the REST API. Active and completed trips remain clearly labelled simulated/planned UI because Sprint 4 has no trip entity. Assignment and dispatch controls are not backed by fake records.

Future sprints may add a Dispatch Board, assignment entities, and inbound HRMS/hotel/restaurant adapters. Sprint 4 does not add optimization, mobile workflows, notifications, hardware, analytics, a new authentication system, or public deployment.
