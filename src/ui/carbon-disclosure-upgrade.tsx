import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Accordion, AccordionItem } from "@carbon/react";

type UpgradedDisclosure = {
  bodyNodes: Node[];
  className: string;
  initiallyOpen: boolean;
  key: string;
  mount: HTMLElement;
  titleHtml: string;
};

type OpenCompatibleElement = HTMLLIElement & { open: boolean };

const disclosureSelector = [
  ".context-detail-panel",
  ".results-detail-panel",
  ".config-detail-panel",
  ".scene-guide-details",
].join(",");

function bodyNodes(disclosure: HTMLElement) {
  return Array.from(disclosure.childNodes);
}

export function prepareCarbonDisclosures(root: ParentNode = document): UpgradedDisclosure[] {
  const documentRef = root.ownerDocument ?? document;
  return Array.from(root.querySelectorAll<HTMLElement>(disclosureSelector)).map((disclosure, index) => {
    const mount = documentRef.createElement("div");
    mount.className = `carbon-disclosure-mount${disclosure.classList.contains("panel-section") ? " panel-section" : ""}`;
    disclosure.replaceWith(mount);
    return {
      bodyNodes: bodyNodes(disclosure),
      className: Array.from(disclosure.classList).filter((name) => name !== "panel-section").join(" "),
      initiallyOpen: disclosure.dataset.initiallyOpen === "true",
      key: disclosure.id || `carbon-disclosure-${index}`,
      mount,
      titleHtml: disclosure.dataset.title || "Details",
    };
  });
}

function CarbonDisclosure({ bodyNodes: nodes, className, initiallyOpen, mount, titleHtml }: Omit<UpgradedDisclosure, "key">) {
  const [open, setOpen] = useState(initiallyOpen);
  const openRef = useRef(open);
  const contentRef = useRef<HTMLDivElement>(null);
  openRef.current = open;

  const mirrorCarbonOpenState = (item: HTMLLIElement, nextOpen: boolean) => {
    item.classList.toggle("cds--accordion__item--active", nextOpen);
    item.querySelector<HTMLElement>(".cds--accordion__heading")
      ?.setAttribute("aria-expanded", String(nextOpen));
  };

  const setCompatibleOpen = (nextOpen: boolean, notify: boolean) => {
    openRef.current = nextOpen;
    setOpen(nextOpen);
    if (notify) {
      window.requestAnimationFrame(() => {
        mount.querySelector(".cds--accordion__item")?.dispatchEvent(new Event("toggle"));
      });
    }
  };

  useLayoutEffect(() => {
    const item = mount.querySelector<OpenCompatibleElement>(".cds--accordion__item");
    if (!item) return;
    Object.defineProperty(item, "open", {
      configurable: true,
      get: () => openRef.current,
      set: (value: boolean) => {
        const nextOpen = Boolean(value);
        if (openRef.current === nextOpen) return;
        openRef.current = nextOpen;
        flushSync(() => setOpen(nextOpen));
        mirrorCarbonOpenState(item, nextOpen);
        window.requestAnimationFrame(() => item.dispatchEvent(new Event("toggle")));
      },
    });
  }, [mount]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    nodes.forEach((node) => content.append(node));
  }, [nodes]);

  return (
    <Accordion align="start" className="carbon-disclosure" size="sm">
      <AccordionItem
        className={className}
        open={open}
        onHeadingClick={({ isOpen }) => setCompatibleOpen(isOpen, true)}
        title={<span dangerouslySetInnerHTML={{ __html: titleHtml }} />}
      >
        <div ref={contentRef} className="carbon-disclosure-content" />
      </AccordionItem>
    </Accordion>
  );
}

export function upgradeCarbonDisclosures(root: ParentNode = document) {
  prepareCarbonDisclosures(root).forEach((disclosure) => {
    const { key, ...props } = disclosure;
    flushSync(() => createRoot(disclosure.mount).render(<CarbonDisclosure key={key} {...props} />));
  });
}

export function installCarbonDisclosureUpgrade() {
  if (!window.FdtdCarbonUI) throw new Error("Carbon UI API must be installed before disclosures");
  window.FdtdCarbonUI.upgradeDisclosures = upgradeCarbonDisclosures;
}
