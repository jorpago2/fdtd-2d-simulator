import { useEffect, useState } from "react";
import { Button, Checkbox } from "@carbon/react";
import { requestRuntimeAction, useFdtdRuntimeState } from "./runtime-state";

function useRuntimeEvent<T>(name: string, initial: T) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const update = (event: Event) => setValue((event as CustomEvent<T>).detail);
    window.addEventListener(name, update);
    return () => window.removeEventListener(name, update);
  }, [name]);
  return value;
}

function formatObservableText(value: unknown) {
  return String(value || "")
    .replaceAll("lambda_s", "λₛ")
    .replaceAll("lambda0", "λ₀")
    .replaceAll("theta_i", "θᵢ")
    .replaceAll("theta_slab", "θslab")
    .replaceAll("dphi", "Δφ")
    .replace(/\bkappa\b/g, "κ")
    .replace(/\beps\b/g, "ε")
    .replace(/\bmu\b/g, "μ")
    .replace(/\bcpw\b/g, "cells/λ")
    .replace(/\s*>=\s*/g, " ≥ ")
    .replace(/\s*<=\s*/g, " ≤ ")
    .replace(/\s*=\s*/g, " = ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

type ObservableRow = {
  metric?: string;
  measured?: string;
  expected?: string;
  error?: string;
  note?: string;
  level?: string;
};

type ObservableReport = {
  title?: string;
  note?: string;
  status?: string;
  rows?: ObservableRow[];
};

export function SceneObservableResults() {
  const report = useRuntimeEvent<ObservableReport>("fdtd:scene-observables", {});
  const rows = report.rows ?? [];
  if (rows.length === 0) {
    return <div id="sceneObservableResults" className="scene-observable-results" aria-live="polite">
      <p className="results-insight-note">{report.note || "Select and run a scene to compare measured quantities with a physics reference."}</p>
    </div>;
  }
  return (
    <div id="sceneObservableResults" className="scene-observable-results" aria-live="polite">
      <article className="scene-observable-card" data-health-level={report.status || "info"}>
        <header>
          <h3>{report.title || "Scene observables"}</h3>
          <span className="scene-observable-status" data-health-level={report.status || "info"}>
            {{ ok: "validated", caution: "check", pending: "pending", info: "reference" }[report.status || "info"] || "reference"}
          </span>
        </header>
        <p className="results-insight-note">{report.note || "Measured quantities are compared with compact scene-specific references."}</p>
        <div className="scene-observable-list">
          {rows.map((row, index) => (
            <div className="scene-observable-row" data-health-level={row.level || "info"} key={`${row.metric}-${index}`}>
              <span className="scene-observable-metric">{row.metric || "Observable"}</span>
              <output className="scene-observable-values">
                {row.measured && <span className="scene-observable-value"><b>Measured</b><span>{formatObservableText(row.measured)}</span></span>}
                {row.expected && <span className="scene-observable-value"><b>Reference</b><span>{formatObservableText(row.expected)}</span></span>}
                {row.error && row.error !== "-" && <span className="scene-observable-value scene-observable-value--error"><span>{formatObservableText(row.error)}</span></span>}
              </output>
              {row.note && <small>{row.note}</small>}
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

type MaxwellRow = {
  label?: string;
  formula?: string;
  residual?: number;
  maxResidual?: number;
  bar?: number;
  level?: string;
  note?: string;
};

type MaxwellSnapshot = {
  enabled?: boolean;
  report?: {
    status?: string;
    component?: string;
    time?: number;
    sampleCount?: number;
    skippedCount?: number;
    stride?: number;
    note?: string;
    rows?: MaxwellRow[];
  };
};

function formatResidual(value: number | undefined) {
  if (!Number.isFinite(value)) return "n/a";
  if (value === 0) return "0";
  const magnitude = Math.abs(value!);
  return magnitude < 1e-3 || magnitude >= 10 ? value!.toExponential(2) : value!.toPrecision(3);
}

export function MaxwellCheckResults() {
  const snapshot = useRuntimeEvent<MaxwellSnapshot>("fdtd:maxwell-check", {});
  const report = snapshot.report ?? {};
  const rows = report.rows ?? [];
  if (!snapshot.enabled || rows.length === 0) {
    return <div id="maxwellCheckResults" className="maxwell-check-results" aria-live="polite">
      <p className="results-insight-note">{report.note || (snapshot.enabled ? "Run at least one step to compare the discrete Yee update against Maxwell curl equations." : "Enable the checker and run or step once.")}</p>
    </div>;
  }
  return (
    <div id="maxwellCheckResults" className="maxwell-check-results" aria-live="polite">
      <article className="maxwell-check-card" data-health-level={report.status || "pending"}>
        <header><h3>Discrete residuals</h3><span className="maxwell-check-status" data-health-level={report.status || "pending"}>{report.status || "pending"}</span></header>
        <p className="results-insight-note">{[report.component || "Yee grid", `t=${Math.round(report.time || 0)}`, `${Math.round(report.sampleCount || 0)} samples`, `${Math.round(report.skippedCount || 0)} skipped`, `stride ${Math.round(report.stride || 1)}`].join(" | ")}</p>
        <p className="results-insight-note">{report.note || "Residuals are normalized and sampled on regular interior cells."}</p>
        <div className="maxwell-equation-grid">
          {rows.map((row, index) => (
            <article className="maxwell-equation-card" data-health-level={row.level || "pending"} style={{ "--residual-width": `${Math.round(Math.max(0, Math.min(1, row.bar || 0)) * 1000) / 10}%` } as React.CSSProperties} key={`${row.label}-${index}`}>
              <h4>{row.label || "Equation"}</h4>
              <p className="maxwell-equation-formula">{row.formula || ""}</p>
              <div className="maxwell-residual-row"><span>normalized RMS</span><output>{formatResidual(row.residual)}</output></div>
              <div className="maxwell-residual-row"><span>max local</span><output>{formatResidual(row.maxResidual)}</output></div>
              <div className="maxwell-residual-bar"><span className="maxwell-residual-fill" /></div>
              {row.note && <small>{row.note}</small>}
            </article>
          ))}
        </div>
      </article>
    </div>
  );
}

type MonitorCard = {
  id: number;
  kind: string;
  warning?: boolean;
  meta: string;
  metrics: Array<{ label: string; value: string }>;
};

export function CustomMonitorResults() {
  const cards = useRuntimeEvent<MonitorCard[]>("fdtd:custom-monitors", []);
  return (
    <div id="customMonitorResults" className="custom-monitor-results" aria-live="polite">
      {cards.length === 0
        ? <p className="results-insight-note">Right-click or long-press the canvas to add a monitor.</p>
        : cards.map((card) => (
          <article className="custom-monitor-card" data-health-level={card.warning ? "caution" : undefined} key={card.id}>
            <header><h3>M{card.id}</h3><span className="monitor-kind">{card.kind}</span></header>
            <p className="results-insight-note">{card.meta}</p>
            <div className="diagnostics-grid">
              {card.metrics.map((metric) => <div className="diagnostic-metric" key={metric.label}><span>{metric.label}</span><output>{metric.value}</output></div>)}
            </div>
          </article>
        ))}
    </div>
  );
}

type LineMonitorSnapshot = {
  angle?: string;
  balanceMethod?: string;
  balanceReady?: boolean;
  incidentPower?: string;
  reflectedPower?: string;
  transmittedPower?: string;
  reflectance?: string;
  transmittance?: string;
  samples?: number;
  step?: number;
};

export function LineMonitorResults() {
  const snapshot = useRuntimeEvent<LineMonitorSnapshot>("fdtd:results-snapshot", {});
  const enabled = useFdtdRuntimeState()?.diagnosticsEnabled ?? false;
  const metrics = [
    ["θₖ", snapshot.angle || "0°"],
    ["Pinc (normalized)", snapshot.incidentPower || "—"],
    ["Pref (normalized)", snapshot.reflectedPower || "—"],
    ["Ptrn (normalized)", snapshot.transmittedPower || "—"],
    ["R (fraction)", snapshot.reflectance || "—"],
    ["T (fraction)", snapshot.transmittance || "—"],
  ];
  return (
    <div className="results-detail-body">
      <Checkbox
        id="diagnosticsInput"
        className="toggle-row"
        labelText="Line monitors"
        checked={enabled}
        onChange={(_, data) => requestRuntimeAction("results-setting", { property: "diagnosticsEnabled", value: data.checked })}
      />
      <div className="diagnostics-grid">
        {metrics.map(([label, value]) => <div className="diagnostic-metric" key={label}><span>{label}</span><output>{value}</output></div>)}
      </div>
      <p className="monitor-evidence-note">Step {(snapshot.step ?? 0).toLocaleString()} · {snapshot.samples ?? 0} samples · {snapshot.balanceReady ? "stable estimator" : "collecting samples"} · {snapshot.balanceMethod || "line monitors"}.</p>
      <p className="results-insight-note">Steady-state powers use a discrete transverse line integral and single-direction wave separation; Floquet orders use a transverse-line mean-field DFT. For bends, multimode guides, or multiple sources, prefer the scene-specific port observable.</p>
      <Button id="diagnosticsResetBtn" kind="ghost" size="sm" type="button">Reset monitors</Button>
    </div>
  );
}

type PerformanceSnapshot = {
  metrics?: Array<[string, string]>;
  status?: string;
};

export function PerformanceResults() {
  const snapshot = useRuntimeEvent<PerformanceSnapshot>("fdtd:performance-snapshot", {
    metrics: [["Engine", "JS"], ["Grid cells", "360 x 240"]],
    status: "Run or step the simulation to collect timing samples.",
  });
  return (
    <div className="config-detail-body">
      <div className="performance-grid" aria-label="Performance summary">
        {(snapshot.metrics ?? []).map(([label, value]) => (
          <div className="diagnostic-metric" key={label}><span>{label}</span><output>{value}</output></div>
        ))}
      </div>
      <div className="performance-actions"><Button id="performanceResetBtn" kind="ghost" size="sm" type="button">Reset samples</Button></div>
      <p className="sweep-status">{snapshot.status}</p>
    </div>
  );
}

export function RuntimeEngine() {
  const snapshot = useRuntimeEvent<{ engine?: string }>("fdtd:results-snapshot", {});
  return <output title="Implementation route; it does not change the physical model.">{snapshot.engine || "JS"}</output>;
}
