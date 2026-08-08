import { useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Accordion, AccordionItem } from "@carbon/react";

type PreparedDisclosure = {
  bodyNodes: Node[];
  className: string;
  initiallyOpen: boolean;
  key: string;
  mount: HTMLElement;
  title: string;
};

type DisclosureController = {
  mount: HTMLElement;
  setOpen: (open: boolean) => void;
};

const disclosureSelector = "[data-carbon-disclosure]";

const disclosureControllers = new Set<DisclosureController>();

function prepareCarbonDisclosures(root: ParentNode = document): PreparedDisclosure[] {
  const documentRef = root.ownerDocument ?? document;
  return Array.from(root.querySelectorAll<HTMLElement>(disclosureSelector)).map((disclosure, index) => {
    const mount = documentRef.createElement("div");
    mount.className = `carbon-disclosure-mount${disclosure.classList.contains("panel-section") ? " panel-section" : ""}`;
    disclosure.replaceWith(mount);
    return {
      bodyNodes: Array.from(disclosure.childNodes),
      className: Array.from(disclosure.classList).filter((name) => name !== "panel-section").join(" "),
      initiallyOpen: disclosure.dataset.initiallyOpen === "true",
      key: disclosure.id || `carbon-disclosure-${index}`,
      mount,
      title: disclosure.dataset.title || "Details",
    };
  });
}

function CarbonDisclosure({
  bodyNodes,
  className,
  initiallyOpen,
  mount,
  onReady,
  title,
}: Omit<PreparedDisclosure, "key"> & { onReady: () => void }) {
  const [open, setOpen] = useState(initiallyOpen);

  useLayoutEffect(() => {
    const controller = { mount, setOpen };
    disclosureControllers.add(controller);
    return () => {
      disclosureControllers.delete(controller);
    };
  }, [mount]);

  const contentRef = (content: HTMLDivElement | null) => {
    if (!content) return;
    bodyNodes.forEach((node) => content.append(node));
    onReady();
  };

  return (
    <Accordion align="start" className="carbon-disclosure" size="sm">
      <AccordionItem
        className={className}
        open={open}
        renderToggle={(props) => <button {...props} data-carbon-react="true" />}
        onHeadingClick={({ isOpen, event }) => {
          setOpen(isOpen);
          event.currentTarget.dispatchEvent(new CustomEvent("toggle", {
            bubbles: true,
            detail: { open: isOpen },
          }));
        }}
        title={title}
      >
        <div ref={contentRef} className="carbon-disclosure-content" />
      </AccordionItem>
    </Accordion>
  );
}

export function upgradeCarbonDisclosures(root: ParentNode = document): Promise<void> {
  const upgrades = prepareCarbonDisclosures(root).map((disclosure) => new Promise<void>((resolve) => {
    const { key, ...props } = disclosure;
    createRoot(disclosure.mount).render(<CarbonDisclosure key={key} {...props} onReady={resolve} />);
  }));
  return Promise.all(upgrades).then(() => undefined);
}

export function closeCarbonDisclosures(root: ParentNode = document) {
  disclosureControllers.forEach((controller) => {
    if (root === document || root.contains(controller.mount)) controller.setOpen(false);
  });
}

export function installCarbonDisclosures() {
  if (!window.FdtdCarbonUI) throw new Error("Carbon UI API must be installed before disclosures");
  window.FdtdCarbonUI.upgradeDisclosures = upgradeCarbonDisclosures;
  window.FdtdCarbonUI.closeDisclosures = closeCarbonDisclosures;
}
