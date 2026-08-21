# Release checklist

Use this when standing up Mosaic on a new Windows machine, or before/after a
version bump on an existing one. See [README.md](README.md) for configuration
reference and [ARCHITECTURE.md](ARCHITECTURE.md) for how the deployment model
works; see [SECURITY.md](SECURITY.md) before exposing it beyond localhost.

## 1. Prerequisites

- [ ] Node.js 24.x or newer installed (`node --version`).
- [ ] If any configured source is `sqlserver`: network reachability to that
      SQL Server confirmed (no local SQL Server client tools are required —
      `mssql` is a pure-JS TDS client).
- [ ] Repository copied (or `git clone`d) onto the target machine.

## 2. Install and configure

- [ ] `npm ci --omit=dev` (or `task install`, then note it doesn't pass
      `--omit=dev` today — pass it manually for a production install to skip
      dev-only tooling, currently a no-op since there are no dev deps, but
      future-proof).
- [ ] Copy `sources.example.json` entries you need into `sources.json`.
      **Do not put live connection strings directly in `sources.json` if it
      might be committed** — use `connectionStringEnvironmentVariable` and
      set the variable outside the repo.
- [ ] Set every environment variable referenced by
      `connectionStringEnvironmentVariable` in `sources.json`.
- [ ] Review `appsettings.json` (or leave it absent to use defaults — see
      README.md's reference table). In particular:
  - `host` — stays `127.0.0.1` unless you have a specific, considered reason
    not to (see SECURITY.md).
  - `sqlCommandTimeoutMs`, `exportLimits`, `fileLimits`,
    `maxRequestBodyBytes` — tune for your data sizes.
  - `logging.directory` — writable by the account the task will run as.
- [ ] If using the committed sample data: `task seed` (creates
      `data/reference.db` and `data/warehouse.db`).
- [ ] `task test` (or `node --test "tests/**/*.test.js"`) passes.

## 3. Smoke test before going unattended

- [ ] `task smoke` (or `pwsh -NoProfile -File scripts/smoke-test.ps1`) passes.
      This starts Mosaic on a scratch port, hits health checks plus a real
      browse/export/configured-page route, and stops it again. Run this
      against your **actual** `sources.json`/`pages/` if they differ from the
      committed sample — the health checks alone don't touch your configured
      sources, but the route checks in the script are hardcoded to the
      sample data (`local-reference`, `operations-overview`); adapt them
      (or just run `node server.js` and click around manually) if your
      deployment doesn't include those.

## 4. Run at startup (Task Scheduler, not a Windows Service)

Mosaic does not ship as a `.exe` and is not installed as a Win32 Service —
see ARCHITECTURE.md's "Windows deployment model" for why. Instead:

- [ ] From an **Administrator** PowerShell prompt:
      `.\scripts\install-task.ps1` (defaults to running as `SYSTEM`; pass
      `-UserId`/`-Password` for a dedicated service account instead).
- [ ] `Start-ScheduledTask -TaskName Mosaic` to start it immediately without
      rebooting, or reboot to confirm the "At startup" trigger works.
- [ ] Confirm it's actually serving: `task smoke` again, or hit
      `http://127.0.0.1:<port>/health/ready` in a browser from the machine.
- [ ] Confirm restart-on-failure: `Get-ScheduledTask -TaskName Mosaic |
      Get-ScheduledTaskInfo` to see its state; note that the configured
      restart count/interval is a bounded number of retries, not infinite
      self-healing (see `install-task.ps1`'s parameters).

## 5. Network exposure

- [ ] If Mosaic must be reachable from other machines, decide **and
      document** how: VPN-only, reverse proxy with authentication, or a
      firewall rule scoped to specific source IPs. Do not open the port
      directly to an untrusted network — there is no authentication (see
      SECURITY.md).
- [ ] If behind a reverse proxy: confirm `trustedProxy.enabled` and
      `trustedProxy.trustedHeaders` in `appsettings.json` match the proxy's
      actual forwarded-header behavior, and that the proxy is the only thing
      that can reach Mosaic directly (firewall the app port from everything
      else).
- [ ] If a Windows Firewall rule is needed for the chosen exposure:
      `New-NetFirewallRule -DisplayName 'Mosaic' -Direction Inbound
      -LocalPort <port> -Protocol TCP -Action Allow -RemoteAddress
      <scoped range, not Any>`.

## 6. Rollback / removal

- [ ] `.\scripts\uninstall-task.ps1` stops and removes the scheduled task.
- [ ] Data files (`data/*.db`) and logs (`logs/`) are untouched by
      uninstall — remove them manually if you're decommissioning, not just
      upgrading.
