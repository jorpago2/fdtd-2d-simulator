import { createRoot } from "react-dom/client";
import legacyRuntimeScripts from "./legacy-runtime.json";
import "./data/scene-catalog-loader";

declare const __FDTD_BUILD_VERSION__: string;

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing React mount point: #${id}`);
  return element;
}

function Brand() {
  return (
    <div className="brand-heading" data-react-ui="brand">
      <h1 className="brand-title">
        <span className="brand-emblem">EM Wave</span> Simulator
      </h1>
    </div>
  );
}

function FooterLinks() {
  return (
    <>
      <a className="canvas-footer-author" data-react-ui="footer" href="https://www.uv.es/jorpago2" target="_blank" rel="noopener noreferrer">
        Jorge Parra
      </a>
      <span className="canvas-footer-separator" aria-hidden="true">·</span>
      <nav className="canvas-footer-links" aria-label="Jorge Parra resources">
        <a href="https://jorpago2.github.io/" target="_blank" rel="noopener noreferrer">
          Online Simulators &amp; Tools <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </>
  );
}

function loadClassicScript(source: string): Promise<void> {
  const scriptUrl = new URL(source, document.baseURI);
  scriptUrl.searchParams.set("v", __FDTD_BUILD_VERSION__);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl.href;
    script.async = false;
    script.dataset.runtimeScript = "";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load runtime script: ${scriptUrl.pathname}`));
    document.body.append(script);
  });
}

async function startLegacyRuntime(): Promise<void> {
  for (const source of legacyRuntimeScripts) await loadClassicScript(source);
}

createRoot(requiredElement("reactBrandRoot")).render(<Brand />);
createRoot(requiredElement("reactFooterRoot")).render(<FooterLinks />);
void startLegacyRuntime().catch((error: unknown) => {
  console.error("FDTD runtime startup failed", error);
});
