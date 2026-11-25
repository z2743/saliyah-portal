# D1 and simulated-bot capacity audit — 2026-11-25

**Scope:** GitHub `z2743/saliyah-portal`, Cloudflare Worker `saliyah-portal`, five D1 bindings. Read-only measurements were made without running, re-enabling, or reducing bots. This report describes what is measured versus hypothetical.

## Confirmed seven-day sampled account analytics

| Binding | Rows read (estimated) | Rows written (estimated) |
| --- | ---: | ---: |
| DB | 139,603,480 | 78,556 |
| FINANCE_DB | 21,095 | 12,031 |
| SIMULATION_DB | 134 | 67 |
| AVIATION_DB | 37 | 40 |
| ARCHIVE_DB | 72 | 15 |

Main DB contributed ~99.985% of estimated reads. **This is not a balanced workload.** Dataset: `events.d1BackendRequest`, weighted by `sampleInterval` over the seven days ending Nov 25. Sampling produces estimates; these are not per-bot totals.

| Day (UTC) | Main DB sampled reads |
| --- | ---: |
| 2026-11-22 | 72,995,289 |
| 2026-11-23 | 55,737,043 |
| 2026-11-24 | 10,528,250 |
| 2026-11-25 (partial day) | ~361,189 at audit |

Measured file sizes at inspection: DB 5,189,632 bytes; FINANCE_DB 761,856; SIMULATION_DB 49,152; AVIATION_DB 24,576; ARCHIVE_DB 24,576. Storage duplication and independent SQL joins prevent a safe 20%-each split.

## Main cost bug and verified optimization

Old simulated citizen selection had `NOT EXISTS` of a death event for every citizen, scanning the event table repeatedly. Historical sampled query telemetry: **13 observed samples**, mean **~6.36 million rows read per invocation**, approximate maximum 9.19 million. Source: `events.d1Queries`; this is **per-query**, not per-bot spending. The historical sampled query aggregate can exceed the separately sampled backend aggregate; do not add the two metrics.

The updated selection excludes deceased occupation and has `idx_sim_citizens_active_created`. The actual D1 query now returned **100 citizens with 100 rows read**; EXPLAIN showed index use. Its reduction relative to that historical sampled mean is ~63,600× for this query, but **not** a whole-site or per-bot reduction factor. A separate `idx_sim_citizens_created` index also covers recent-citizen pagination.

Further GitHub optimizations bootstrap the 3,000-person fictional population once and skip recurrent full scans to assign all fictional X account names. The supporting D1 indexes are present on the live database. GitHub automated checks passed. No simulation was invoked.

## Bot inventory and interpretation

Current DB record counts: 3,015 simulated citizens, 2,000 profiles with `kind='bot'` on X, and 41 legal-bot records. Sum **5,056 persona records** across systems, **not** 5,056 proven independent bots, Workers invocations, or jobs. Bots are paused in scheduled runtime; the manual simulation endpoint is also blocked.

**No exact measured per-bot daily row cost exists** in the current telemetry: SQL operations are batched across fictional citizens, X and judiciary, and routine human/admin queries share DB. To calculate real cost requires per-cycle counters tagged by workload, sampled only when a controlled future run is explicitly approved.

## Capacity, conditional on Workers Free

Cloudflare's documented **account-level** free D1 budget is 5,000,000 rows read/day and 100,000 written/day. Adding databases does not multiply the budget, and index maintenance adds writes. Source: https://developers.cloudflare.com/d1/platform/pricing/

Purely hypothetical maxima **if all other reads were zero**:

| Assumed rows read per persona per day | Personas reaching 5M daily rows |
| ---: | ---: |
| 100 | 50,000 |
| 500 | 10,000 |
| 1,000 | 5,000 |
| 5,000 | 1,000 |

These are **scenarios, not measured per-bot consumption**. For 5,056 persona records, the entire free-read budget divided by personas is ~989 rows/day/record; real capacity is smaller after site traffic, batching and other queries. For any paid plan, these free-tier thresholds do not directly apply.

**Decision:** retain existing bot counts while paused; no technical evidence currently supports choosing a safe reduced count. Do not restart bots until approved, and do not claim equal D1 distribution. Prioritize indexing/query optimization and preserving transaction atomicity over redistributing interconnected financial tables.
