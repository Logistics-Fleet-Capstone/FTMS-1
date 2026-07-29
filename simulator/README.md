# Simulated telemetry pilot

The simulator uses only Python's standard library. It sends deterministic-looking pilot
samples for `LILYGO-001` directly to the Sprint 1 REST ingestion endpoint; MQTT and hardware
integration remain out of scope.

Start the Compose stack, apply migrations, and seed the demo vehicle:

```bash
docker compose up --build -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo_vehicle
```

Send one event:

```bash
python3 simulator/simulate_telemetry.py
```

Send five events at a shorter interval:

```bash
python3 simulator/simulate_telemetry.py --count 5 --interval-seconds 0.2
```

The third sample deliberately sends unavailable OBD-II fields as JSON `null`, never as
fabricated zeroes. Each run uses unique event IDs and increasing sequence numbers.
