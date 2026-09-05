import { useEffect, useRef } from "react";
import { Button } from "@carbon/react";

export default function DevelopmentNotice() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const frame = requestAnimationFrame(() => {
      if (dialog && !dialog.open) dialog.showModal();
    });
    return () => {
      cancelAnimationFrame(frame);
      dialog?.close();
    };
  }, []);

  return <>
    <style>{`
      .development-notice {
        position: fixed; inset: 0; margin: auto; padding: 0;
        width: min(30rem, calc(100% - 2rem)); max-height: calc(100dvh - 2rem);
        border: 0; border-top: 3px solid var(--cds-support-warning, #f1c21b);
        background: var(--cds-layer-01, #f4f4f4); color: var(--cds-text-primary, #161616);
        box-shadow: 0 12px 48px #0006; font: inherit;
      }
      .development-notice::backdrop { background: #0009; }
      .development-notice__body { padding: 1.5rem; }
      .development-notice h2 { font-size: 1.5rem; font-weight: 400; line-height: 1.3; margin: 0 0 1rem; }
      .development-notice p { font-size: 1rem; font-weight: 400; line-height: 1.5; margin: 0 0 1rem; }
      .development-notice p:last-child { margin-bottom: 0; }
      .development-notice__actions { display: flex; justify-content: flex-end; padding: 0 1.5rem 1.5rem; }
    `}</style>
    <dialog ref={dialogRef} className="development-notice" aria-labelledby="development-notice-title" aria-describedby="development-notice-description">
      <div className="development-notice__body">
        <h2 id="development-notice-title">Application under development</h2>
        <div id="development-notice-description">
          <p>This application is still under active development. Some features may not work as expected, and errors or inaccurate results may occur.</p>
          <p>Please verify important results independently before relying on them.</p>
        </div>
      </div>
      <div className="development-notice__actions">
        <Button autoFocus onClick={() => dialogRef.current?.close()}>I understand — Continue</Button>
      </div>
    </dialog>
  </>;
}
