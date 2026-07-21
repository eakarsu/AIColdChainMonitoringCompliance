# Operations

Copy `.env.example` to `.env`, replace every secret, run `scripts/bootstrap.sh` once, and apply reviewed migrations with `scripts/migrate.sh`. `start.sh` is non-destructive. Demo seeding requires `CONFIRM_DEMO_SEED=yes` plus explicit demo passwords.

The governed API is `/api/lot-workflow`. Telemetry requires a signed device envelope and a registered, unrevoked, calibrated device. Lot release requires a quality role and closed corrective actions; custody events enforce a hash chain. Production sensor/gateway enrollment, WMS/TMS/ERP adapters, jurisdiction retention review, calibrated hardware tests, alert delivery, and regulated-quality validation remain external gates.
