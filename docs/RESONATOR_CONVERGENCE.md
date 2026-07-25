# P0 resonator convergence

Generated 2026-07-25 from the browser physics harness. This is a direct two-grid verification at 20 and 32 cells per free-space wavelength; it is not a three-level Richardson/GCI study.

## Method

- The physical domain is preserved when refining from 20 to 32 cells/λ₀.
- A coarse 0.45–0.65 source-frequency sweep locates the resonance, followed by 40-cycle harmonic runs at the selected and reference points.
- Through-port notch uses raw modal output power. Ring, add-drop, racetrack, and quarter-wave references use the characterized off-resonance point; the stub uses an otherwise identical straight-guide run at the same frequency to remove source and grid normalization bias.
- Stored-energy convergence uses the resonant harmonic run except for the pulsed quarter-wave preset, where the preset's Ricker excitation is compared at equal physical time.
- Notch change is reported in percentage points. Frequency and stored-energy changes are relative.

## Results

| Preset | Resonance scale 20 / 32 | Stored-energy metric 20 / 32 | Notch 20 / 32 | Δf | Δenergy | Δnotch | Other acceptance evidence | Status |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Ring | 0.4500 / 0.4500 | `E_ring/E_total` 0.632 / 0.598 | 83.2% / 79.1% | 0.0% | 5.4% | 4.1 pp | `E_ring/E_bus` > 0.20; cancellation cosine < -0.999 | PASS |
| Add-drop ring | 0.4500 / 0.45625 | `E_ring/E_total` 0.439 / 0.408 | 97.9% / 99.5% | 1.4% | 7.2% | 1.6 pp | Drop fraction 18.6% / 25.1%; on/off drop-to-bus ratio 9.2× / 11.6× | PASS |
| Racetrack | 0.4625 / 0.4625 | `E_race/E_total` 0.481 / 0.463 | 80.5% / 80.6% | 0.0% | 3.6% | 0.1 pp | Default-pulse Q 430 / 672 | PASS |
| Quarter-wave cavity | 0.5500 / 0.565625 | pulsed `E_stub/E_total` 0.0245 / 0.0240 | 44.7% / 50.0% | 2.8% | 2.0% | 5.2 pp | Standing visibility 0.929 / 0.858; Q 191 / 211 | PASS |
| Stub resonator | 0.5000 / 0.5125 | `E_stub/E_total` 0.0687 / 0.0631 | 45.8% / 47.8% | 2.5% | 8.1% | 2.0 pp | Standing visibility 0.795 / 0.907 | PASS |

All selected points retain at least 10 cells per shortest material wavelength. The nominal 0.10 λ₀ coupling gap resolves to at least two cells at 20 cells/λ₀. The default 20-cell runs expose the validated signature in 0.87–2.50 s, below the 6 s limit.

## Reproduction

Use the bundled Node runtime reported by the workspace dependency helper. A representative long run is:

```powershell
& <node> scripts/browser-smoke.mjs --physics --case ring_resonator_coupling --source-type sine --source-frequency-scale 0.45 --steps 16000 --cells-per-wavelength 20 --summary
& <node> scripts/browser-smoke.mjs --physics --case ring_resonator_coupling --source-type sine --source-frequency-scale 0.45 --steps 25600 --cells-per-wavelength 32 --preserve-domain --summary
```

Replace the case and frequency scale with the selected values in the table. For the stub reference, run `slab_waveguide_confinement` with `--source-x-lambda 7.5 --source-amplitude 0.56` at the same frequency.
