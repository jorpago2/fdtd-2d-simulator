import type { ButtonHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Button } from "@carbon/react";

type BridgedButton = {
  attributes: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, string | boolean>;
  className: string;
  html: string;
  key: string;
  kind: "danger--tertiary" | "primary" | "ghost";
  mount: HTMLElement;
};

function keepCustom(button: HTMLButtonElement) {
  return Boolean(button.closest(
    "[data-carbon-react-root], [data-react-ui], .canvas-view-controls, template, .scene-card, [data-brush], [data-brush-tool], [data-canvas-add]",
  ));
}

function buttonKind(button: HTMLButtonElement) {
  if (/delete|remove|clear/i.test(`${button.id} ${button.textContent}`)) return "danger--tertiary" as const;
  if (button.classList.contains("primary-button")) return "primary" as const;
  return "ghost" as const;
}

function collectAttributes(button: HTMLButtonElement) {
  const attributes: Record<string, string | boolean> = {};
  for (const attribute of Array.from(button.attributes)) {
    if (["class", "disabled", "hidden"].includes(attribute.name)) continue;
    attributes[attribute.name] = attribute.value;
  }
  if (button.disabled) attributes.disabled = true;
  if (button.hidden) attributes.hidden = true;
  return attributes;
}

export function prepareCarbonButtonBridge(documentRef: Document = document) {
  const buttons = Array.from(documentRef.querySelectorAll<HTMLButtonElement>("button:not([data-carbon-react])"))
    .filter((button) => !keepCustom(button));

  return buttons.map((button, index): BridgedButton => {
    const mount = documentRef.createElement("span");
    mount.className = "carbon-button-mount";
    button.replaceWith(mount);
    return {
      attributes: collectAttributes(button),
      className: button.className,
      html: button.innerHTML,
      key: button.id || `carbon-button-${index}`,
      kind: buttonKind(button),
      mount,
    };
  });
}

export function CarbonButtonBridge({ buttons }: { buttons: BridgedButton[] }) {
  return buttons.map(({ attributes, className, html, key, kind, mount }) => createPortal(
    <Button
      {...attributes}
      className={className}
      kind={kind}
      size="sm"
      data-carbon-react="true"
    >
      <span className="carbon-button-content" dangerouslySetInnerHTML={{ __html: html }} />
    </Button>,
    mount,
    key,
  ));
}
