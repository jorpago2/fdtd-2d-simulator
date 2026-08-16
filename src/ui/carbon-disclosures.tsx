import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Accordion, AccordionItem } from "@carbon/react";

type DisclosureController = {
  element: HTMLElement;
  setOpen: (open: boolean) => void;
};

const disclosureControllers = new Set<DisclosureController>();

export function CarbonDisclosure({
  children,
  className = "",
  initiallyOpen = false,
  title,
}: {
  children: ReactNode;
  className?: string;
  initiallyOpen?: boolean;
  title: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const elementRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const controller = { element, setOpen };
    disclosureControllers.add(controller);
    return () => {
      disclosureControllers.delete(controller);
    };
  }, []);

  return (
    <div ref={elementRef} className={className.includes("panel-section") ? "carbon-disclosure-mount panel-section" : "carbon-disclosure-mount"}>
      <Accordion align="start" className="carbon-disclosure" size="sm">
        <AccordionItem
          className={className.replace(/\bpanel-section\b/g, "").trim()}
          open={open}
          onHeadingClick={({ isOpen, event }) => {
            setOpen(isOpen);
            event.currentTarget.dispatchEvent(new CustomEvent("toggle", {
              bubbles: true,
              detail: { open: isOpen },
            }));
          }}
          title={title}
        >
          <div className="carbon-disclosure-content">{children}</div>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function closeCarbonDisclosures(root: ParentNode = document) {
  disclosureControllers.forEach((controller) => {
    if (root === document || root.contains(controller.element)) controller.setOpen(false);
  });
}

export function installCarbonDisclosures() {
  if (!window.FdtdCarbonUI) throw new Error("Carbon UI API must be installed before disclosures");
  window.FdtdCarbonUI.closeDisclosures = closeCarbonDisclosures;
}
