import {
  Children,
  cloneElement,
  isValidElement,
  memo,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Button, Checkbox, FileUploaderButton, IconButton, Select, TextArea, TextInput } from "@carbon/react";
import { Close } from "@carbon/react/icons";

type CarbonInputProps = InputHTMLAttributes<HTMLInputElement> & {
  controlled?: boolean;
  hideLabel?: boolean;
  labelText?: ReactNode;
};

type CarbonSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  controlled?: boolean;
  hideLabel?: boolean;
  labelText?: ReactNode;
};

type CarbonTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hideLabel?: boolean;
  labelText?: ReactNode;
};

function readableLabel(node: ReactNode): string {
  return Children.toArray(node).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (!isValidElement<{ children?: ReactNode }>(child)) return "";
    return readableLabel(child.props.children);
  }).join(" ").replace(/\s+/g, " ").trim();
}

function inputLabel(props: { id?: string; labelText?: ReactNode; "aria-label"?: string }) {
  return props.labelText || props["aria-label"] || props.id || "Control";
}

export const CarbonButton = memo(function CarbonButton({
  children,
  className,
  disabled,
  hidden,
  ...sourceProps
}: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) {
  const props = { ...sourceProps };
  const iconOnly = props["data-carbon-icon-only"] === "true";
  const requestedKind = props["data-carbon-kind"];
  const kind = requestedKind === "primary" || requestedKind === "danger--tertiary"
    ? requestedKind
    : "ghost";
  const description = String(props["aria-label"] || props.title || "Action");
  delete props["data-carbon-kind"];
  delete props["data-carbon-icon-only"];

  if (iconOnly && description.startsWith("Close")) {
    delete props["aria-label"];
    return (
      <IconButton
        {...(props as unknown as ComponentProps<typeof IconButton>)}
        className={className}
        disabled={disabled}
        hidden={hidden}
        kind="ghost"
        label={description}
        size="lg"
        data-carbon-component="IconButton"
        data-carbon-react="true"
      >
        <Close aria-hidden size={20} />
      </IconButton>
    );
  }

  return (
    <Button
      {...(props as ComponentProps<typeof Button>)}
      className={className}
      disabled={disabled}
      hidden={hidden}
      kind={kind}
      size="sm"
      hasIconOnly={iconOnly}
      iconDescription={iconOnly ? description : undefined}
      data-carbon-react="true"
    >
      <span className="carbon-button-content">{children}</span>
    </Button>
  );
});

export function CarbonInput({
  checked,
  controlled = false,
  defaultChecked,
  defaultValue,
  hideLabel = true,
  labelText,
  type = "text",
  value,
  ...props
}: CarbonInputProps) {
  const initialValue = defaultValue ?? value;
  if (type === "checkbox") {
    return (
      <Checkbox
        {...(props as ComponentProps<typeof Checkbox>)}
        checked={controlled ? Boolean(checked) : undefined}
        defaultChecked={controlled ? undefined : defaultChecked ?? checked}
        onChange={controlled ? (props.onChange as ComponentProps<typeof Checkbox>["onChange"]) ?? (() => undefined) : props.onChange as ComponentProps<typeof Checkbox>["onChange"]}
        hideLabel={hideLabel}
        labelText={inputLabel({ ...props, labelText })}
        data-carbon-react="true"
      />
    );
  }
  return (
    <TextInput
      {...(props as ComponentProps<typeof TextInput>)}
      value={controlled ? Array.isArray(initialValue) ? initialValue[0] : initialValue : undefined}
      defaultValue={controlled ? undefined : Array.isArray(initialValue) ? initialValue[0] : initialValue}
      onChange={controlled ? (props.onChange as ComponentProps<typeof TextInput>["onChange"]) ?? (() => undefined) : props.onChange as ComponentProps<typeof TextInput>["onChange"]}
      hideLabel={hideLabel}
      labelText={inputLabel({ ...props, labelText })}
      size="sm"
      type={type}
      data-carbon-react="true"
    />
  );
}

export function CarbonFileInput({
  accept,
  className,
  id,
  labelText,
  onChange,
}: {
  accept?: string;
  className?: string;
  id: string;
  labelText: ReactNode;
  onChange?: ComponentProps<typeof FileUploaderButton>["onChange"];
}) {
  return (
    <FileUploaderButton
      accept={accept?.split(",").map((value) => value.trim()).filter(Boolean)}
      buttonKind="ghost"
      className={className}
      id={id}
      labelText={labelText}
      onChange={onChange}
      size="sm"
    />
  );
}

export function CarbonSelect({
  children,
  controlled = false,
  defaultValue,
  hideLabel = true,
  labelText,
  value,
  ...props
}: CarbonSelectProps) {
  return (
    <Select
      {...(props as ComponentProps<typeof Select>)}
      value={controlled ? value : undefined}
      defaultValue={controlled ? undefined : defaultValue ?? value}
      onChange={controlled ? (props.onChange as ComponentProps<typeof Select>["onChange"]) ?? (() => undefined) : props.onChange as ComponentProps<typeof Select>["onChange"]}
      labelText={String(inputLabel({ ...props, labelText }))}
      noLabel={hideLabel}
      size="sm"
      data-carbon-react="true"
    >
      {children}
    </Select>
  );
}

export function CarbonTextArea({
  defaultValue,
  hideLabel = true,
  labelText,
  value,
  ...props
}: CarbonTextAreaProps) {
  const initialValue = defaultValue ?? value;
  return (
    <TextArea
      {...(props as ComponentProps<typeof TextArea>)}
      defaultValue={Array.isArray(initialValue) ? initialValue[0] : initialValue}
      hideLabel={hideLabel}
      labelText={String(inputLabel({ ...props, labelText }))}
      data-carbon-react="true"
    />
  );
}

type FieldControl = ReactElement<CarbonInputProps | CarbonSelectProps | CarbonTextAreaProps>;

function isFieldControl(child: ReactNode): child is FieldControl {
  return isValidElement(child) && (
    child.type === CarbonInput || child.type === CarbonSelect || child.type === CarbonTextArea
  );
}

export function CarbonField({ children, className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  const items = Children.toArray(children);
  const controlIndex = items.findIndex(isFieldControl);
  if (controlIndex < 0) return <label {...props} className={className}>{children}</label>;

  const control = items[controlIndex] as FieldControl;
  const content = items.filter((_, index) => index !== controlIndex);
  const labelText = readableLabel(content) || control.props.id || "Control";
  if (control.type === CarbonInput && (control.props as CarbonInputProps).type === "checkbox") {
    return (
      <div {...(props as HTMLAttributes<HTMLDivElement>)} className={className} data-carbon-field-shell>
        {cloneElement(control, {
          hideLabel: false,
          labelText: <>{content}</>,
          title: props.title,
        })}
      </div>
    );
  }

  return (
    <div {...(props as HTMLAttributes<HTMLDivElement>)} className={className} data-carbon-field-shell>
      {content}
      {cloneElement(control, { hideLabel: true, labelText })}
    </div>
  );
}
