import { createElement, Fragment } from "react";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, Checkbox, IconButton, Select, TextArea, TextInput } from "@carbon/react";
import { Close } from "@carbon/react/icons";

type BridgedButton = {
  attributes: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, string | boolean>;
  className: string;
  content: ReactNode;
  iconDescription?: string;
  iconOnly: boolean;
  key: string;
  kind: "danger--tertiary" | "primary" | "ghost";
  mount: HTMLElement;
};

type SelectOption = {
  disabled: boolean;
  label: string;
  value: string;
};

type SelectGroup = {
  disabled: boolean;
  label: string;
  options: SelectOption[];
};

type BridgedFormControl = {
  attributes: Record<string, string | boolean>;
  defaultChecked?: boolean;
  defaultValue?: string;
  key: string;
  kind: "checkbox" | "select" | "text" | "textarea";
  labelContent: ReactNode;
  labelText: string;
  mount: HTMLElement;
  options?: Array<SelectOption | SelectGroup>;
  type?: string;
};

function keepCustom(button: HTMLButtonElement) {
  return button.hidden || Boolean(button.closest(
    "[data-carbon-react-root], [data-react-ui], template, [data-carbon-react]",
  ));
}

function buttonKind(button: HTMLButtonElement) {
  if (button.dataset.carbonKind === "danger--tertiary") return "danger--tertiary" as const;
  if (button.dataset.carbonKind === "primary") return "primary" as const;
  return "ghost" as const;
}

function collectAttributes(button: HTMLButtonElement) {
  const attributes: Record<string, string | boolean> = {};
  for (const attribute of Array.from(button.attributes)) {
    if (["class", "disabled", "hidden", "data-carbon-kind", "data-carbon-icon-only"].includes(attribute.name)) continue;
    attributes[reactAttributeNames[attribute.name] || attribute.name] = attribute.value;
  }
  if (button.disabled) attributes.disabled = true;
  if (button.hidden) attributes.hidden = true;
  return attributes;
}

const reactAttributeNames: Record<string, string> = {
  autocomplete: "autoComplete",
  class: "className",
  inputmode: "inputMode",
  maxlength: "maxLength",
  minlength: "minLength",
  readonly: "readOnly",
  tabindex: "tabIndex",
};

function collectControlAttributes(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const attributes: Record<string, string | boolean> = {};
  for (const attribute of Array.from(element.attributes)) {
    if (["checked", "disabled", "hidden", "type", "value"].includes(attribute.name)) continue;
    attributes[reactAttributeNames[attribute.name] || attribute.name] = attribute.value;
  }
  if (element.disabled) attributes.disabled = true;
  if (element.hidden) attributes.hidden = true;
  return attributes;
}

const supportedInlineTags = new Set(["b", "br", "code", "em", "i", "small", "span", "strong", "sub", "sup"]);

function domAttributes(element: Element) {
  const attributes: Record<string, string | boolean> = {};
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name === "class") attributes.className = attribute.value;
    else if (attribute.name !== "style") attributes[attribute.name] = attribute.value;
  }
  return attributes;
}

function domNodeToReact(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof Element)) return null;
  const children = Array.from(node.childNodes).map((child, index) => domNodeToReact(child, `${key}-${index}`));
  const tag = node.tagName.toLowerCase();
  if (!supportedInlineTags.has(tag)) return createElement(Fragment, { key }, children);
  return createElement(tag, { ...domAttributes(node), key }, children);
}

function domChildrenToReact(element: Element): ReactNode {
  return Array.from(element.childNodes).map((node, index) => domNodeToReact(node, String(index)));
}

function labelElement(element: Element) {
  return element.closest("label")?.querySelector(":scope > span") || null;
}

function checkboxMount(input: HTMLInputElement, documentRef: Document) {
  const label = input.closest("label");
  const mount = documentRef.createElement("div");
  if (label) {
    Array.from(label.attributes).forEach((attribute) => mount.setAttribute(attribute.name, attribute.value));
    label.replaceWith(mount);
  } else {
    input.replaceWith(mount);
  }
  mount.classList.add("carbon-checkbox-mount");
  mount.dataset.carbonFieldShell = "";
  return mount;
}

function selectOptions(select: HTMLSelectElement): Array<SelectOption | SelectGroup> {
  return Array.from(select.children).map((child) => {
    if (child instanceof HTMLOptGroupElement) {
      return {
        disabled: child.disabled,
        label: child.label,
        options: Array.from(child.children).map((option) => ({
          disabled: (option as HTMLOptionElement).disabled,
          label: option.textContent || "",
          value: (option as HTMLOptionElement).value,
        })),
      };
    }
    const option = child as HTMLOptionElement;
    return { disabled: option.disabled, label: option.textContent || "", value: option.value };
  });
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
      content: domChildrenToReact(button),
      iconDescription: button.getAttribute("aria-label") || button.title || undefined,
      iconOnly: button.dataset.carbonIconOnly === "true",
      key: button.id || `carbon-button-${index}`,
      kind: buttonKind(button),
      mount,
    };
  });
}

export function CarbonButtonBridge({ buttons }: { buttons: BridgedButton[] }) {
  return buttons.map(({ attributes, className, content, iconDescription, iconOnly, key, kind, mount }) => {
    const usesCloseIcon = iconOnly && Boolean(iconDescription?.startsWith("Close"));
    if (usesCloseIcon) {
      const buttonAttributes = { ...attributes };
      delete buttonAttributes["aria-label"];
      return createPortal(
        <IconButton
          {...buttonAttributes}
          className={className}
          kind="ghost"
          size="lg"
          label={iconDescription || "Close"}
          data-carbon-react="true"
          data-carbon-component="IconButton"
        >
          <Close size={20} aria-hidden={true} />
        </IconButton>,
        mount,
        key,
      );
    }
    return createPortal(
      <Button
        {...attributes}
        className={className}
        kind={kind}
        size="sm"
        hasIconOnly={iconOnly}
        iconDescription={iconOnly ? iconDescription : undefined}
        data-carbon-react="true"
      >
        <span className="carbon-button-content">{content}</span>
      </Button>,
      mount,
      key,
    );
  });
}

export function prepareCarbonFormBridge(documentRef: Document = document) {
  const selector = "input[type='number'], input[type='checkbox'], select, textarea";
  const controls = Array.from(documentRef.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector))
    .filter((control) => !control.closest("[data-carbon-react-root], [data-react-ui], template, [data-carbon-react]"));

  return controls.map((control, index): BridgedFormControl => {
    const isCheckbox = control instanceof HTMLInputElement && control.type === "checkbox";
    const mount = isCheckbox ? checkboxMount(control, documentRef) : documentRef.createElement("span");
    if (!isCheckbox) {
      mount.className = control instanceof HTMLTextAreaElement ? "carbon-textarea-mount" : "carbon-control-mount";
      control.replaceWith(mount);
    }
    const label = labelElement(control);
    return {
      attributes: collectControlAttributes(control),
      defaultChecked: isCheckbox ? (control as HTMLInputElement).checked : undefined,
      defaultValue: isCheckbox ? undefined : control.value,
      key: control.id || `carbon-form-control-${index}`,
      kind: isCheckbox ? "checkbox" : control instanceof HTMLSelectElement ? "select" : control instanceof HTMLTextAreaElement ? "textarea" : "text",
      labelContent: label ? domChildrenToReact(label) : control.getAttribute("aria-label") || "",
      labelText: label?.textContent?.trim() || control.getAttribute("aria-label") || control.id || "Control",
      mount,
      options: control instanceof HTMLSelectElement ? selectOptions(control) : undefined,
      type: control instanceof HTMLInputElement ? control.type : undefined,
    };
  });
}

function SelectChildren({ options = [] }: { options?: Array<SelectOption | SelectGroup> }) {
  return options.map((option) => "options" in option ? (
    <optgroup disabled={option.disabled} label={option.label} key={option.label}>
      {option.options.map((item) => <option disabled={item.disabled} value={item.value} key={item.value}>{item.label}</option>)}
    </optgroup>
  ) : <option disabled={option.disabled} value={option.value} key={option.value}>{option.label}</option>);
}

export function CarbonFormBridge({ controls }: { controls: BridgedFormControl[] }) {
  return controls.map(({ attributes, defaultChecked, defaultValue, key, kind, labelContent, labelText, mount, options, type }) => {
    let control: ReactNode;
    if (kind === "checkbox") {
      control = (
        <Checkbox
          {...(attributes as unknown as ComponentProps<typeof Checkbox>)}
          data-carbon-react="true"
          defaultChecked={defaultChecked}
          labelText={<>{labelContent}</>}
        />
      );
    } else if (kind === "select") {
      control = (
        <Select {...(attributes as unknown as ComponentProps<typeof Select>)} data-carbon-react="true" defaultValue={defaultValue} noLabel size="sm">
          <SelectChildren options={options} />
        </Select>
      );
    } else if (kind === "textarea") {
      control = (
        <TextArea
          {...(attributes as unknown as ComponentProps<typeof TextArea>)}
          data-carbon-react="true"
          defaultValue={defaultValue}
          hideLabel
          labelText="Scene state URL"
        />
      );
    } else {
      control = (
        <TextInput
          {...(attributes as unknown as ComponentProps<typeof TextInput>)}
          data-carbon-react="true"
          defaultValue={defaultValue}
          hideLabel
          labelText={labelText}
          size="sm"
          type={type}
        />
      );
    }
    return createPortal(control, mount, key);
  });
}
