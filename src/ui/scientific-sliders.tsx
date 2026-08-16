import { useLayoutEffect, useRef, useState } from "react";
import { Slider, TextInput } from "@carbon/react";

type SliderConfiguration = {
  disabled: boolean;
  labelText: string;
  max: number;
  min: number;
  step: number;
  value: number;
};

export type ScientificSliderControl = {
  addEventListener: HTMLElement["addEventListener"];
  disabled: boolean;
  dispatchEvent: HTMLElement["dispatchEvent"];
  focus: HTMLElement["focus"];
  labelText: string;
  max: string;
  min: string;
  removeEventListener: HTMLElement["removeEventListener"];
  step: string;
  value: string;
};

type ScientificSliderDefinition = {
  controlId: string;
  initial: SliderConfiguration;
  labelId?: string;
};

const definitions: ScientificSliderDefinition[] = [
  { controlId: "frequencyInput", initial: { labelText: "Source wavelength λₛ / λ₀", min: 0.25, max: 5, step: 0.01, value: 1, disabled: false } },
  { controlId: "amplitudeInput", labelId: "sourceAmplitudeLabel", initial: { labelText: "Source amplitude Jz,₀", min: 0.05, max: 1.2, step: 0.05, value: 0.55, disabled: false } },
  { controlId: "sourceWidthInput", initial: { labelText: "FWHM / λ₀", min: 0.05, max: 1.5, step: 0.05, value: 0.35, disabled: true } },
  { controlId: "sourceAngleInput", initial: { labelText: "Source axis θ (°)", min: 0, max: 360, step: 1, value: 0, disabled: true } },
  { controlId: "sourceTimePhaseInput", initial: { labelText: "Phase φ (°)", min: -180, max: 180, step: 1, value: 0, disabled: false } },
  { controlId: "monitorLengthInput", initial: { labelText: "Monitor length / λ₀", min: 0.1, max: 8, step: 0.05, value: 2, disabled: false } },
  { controlId: "monitorAngleInput", initial: { labelText: "Monitor angle θ (°)", min: 0, max: 180, step: 1, value: 90, disabled: false } },
  { controlId: "brushMenuSizeInput", initial: { labelText: "Brush size / λ₀", min: 0.05, max: 0.8, step: 0.05, value: 0.2, disabled: false } },
  { controlId: "speedInput", initial: { labelText: "Playback speed", min: 0.1, max: 10, step: 0.1, value: 1, disabled: false } },
  { controlId: "gainInput", initial: { labelText: "Display gain", min: 0.2, max: 2.6, step: 0.05, value: 1, disabled: false } },
];

const controls = new Map<string, ScientificSliderControl>();

declare global {
  interface Window {
    FdtdScientificControls?: {
      get: (id: string) => ScientificSliderControl | null;
      setLabel: (id: string, labelText: string) => void;
    };
  }
}

function numericValue(value: string | number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ScientificSlider({ definition }: { definition: ScientificSliderDefinition }) {
  const [configuration, setConfiguration] = useState(definition.initial);
  const [exactValue, setExactValue] = useState(String(definition.initial.value));
  const [revision, setRevision] = useState(0);
  const configurationRef = useRef(configuration);
  const eventTargetRef = useRef(new EventTarget());
  configurationRef.current = configuration;

  const update = (patch: Partial<SliderConfiguration>, remount = false) => {
    if (Object.entries(patch).every(([key, value]) => configurationRef.current[key as keyof SliderConfiguration] === value)) {
      return false;
    }
    const next = { ...configurationRef.current, ...patch };
    configurationRef.current = next;
    setConfiguration(next);
    if (patch.value !== undefined) setExactValue(String(next.value));
    if (remount) setRevision((current) => current + 1);
    return true;
  };

  const commitExactValue = (value: string | number) => {
    const current = configurationRef.current;
    const nextValue = numericValue(value, current.value);
    const committedValue = Math.min(current.max, Math.max(current.min, nextValue));
    update({ value: committedValue }, true);
    window.dispatchEvent(new CustomEvent("fdtd:slider-input", {
      detail: { id: definition.controlId, value: committedValue },
    }));
    requestAnimationFrame(() => eventTargetRef.current.dispatchEvent(new Event("input")));
  };

  useLayoutEffect(() => {
    const controller = {
      addEventListener: eventTargetRef.current.addEventListener.bind(eventTargetRef.current) as HTMLElement["addEventListener"],
      removeEventListener: eventTargetRef.current.removeEventListener.bind(eventTargetRef.current) as HTMLElement["removeEventListener"],
      dispatchEvent: eventTargetRef.current.dispatchEvent.bind(eventTargetRef.current) as HTMLElement["dispatchEvent"],
      focus: ((options?: FocusOptions) => document.getElementById(definition.controlId)?.focus(options)) as HTMLElement["focus"],
    } as ScientificSliderControl;

    Object.defineProperties(controller, {
      value: {
        get: () => String(configurationRef.current.value),
        set: (value: string | number) => update({ value: numericValue(value, configurationRef.current.value) }, true),
      },
      min: {
        get: () => String(configurationRef.current.min),
        set: (value: string | number) => update({ min: numericValue(value, configurationRef.current.min) }, true),
      },
      max: {
        get: () => String(configurationRef.current.max),
        set: (value: string | number) => update({ max: numericValue(value, configurationRef.current.max) }, true),
      },
      step: {
        get: () => String(configurationRef.current.step),
        set: (value: string | number) => update({ step: value === "any" ? 0.01 : numericValue(value, configurationRef.current.step) }, true),
      },
      disabled: {
        get: () => configurationRef.current.disabled,
        set: (disabled: boolean) => update({ disabled: Boolean(disabled) }),
      },
      labelText: {
        get: () => configurationRef.current.labelText,
        set: (labelText: string) => update({ labelText }),
      },
    });

    controls.set(definition.controlId, controller);
    return () => {
      controls.delete(definition.controlId);
    };
  }, [definition]);

  return (
    <div className="scientific-slider-control">
      <Slider
        key={`${definition.controlId}-${revision}`}
        id={definition.controlId}
        className="scientific-slider"
        min={configuration.min}
        max={configuration.max}
        step={configuration.step}
        value={configuration.value}
        disabled={configuration.disabled}
        hideTextInput
        ariaLabelInput={`${configuration.labelText} exact value`}
        labelText={<span id={definition.labelId}>{configuration.labelText}</span>}
        onChange={({ value }) => {
          const nextValue = numericValue(value as number, configurationRef.current.value);
          if (!update({ value: nextValue })) return;
          window.dispatchEvent(new CustomEvent("fdtd:slider-input", {
            detail: { id: definition.controlId, value: nextValue },
          }));
          requestAnimationFrame(() => eventTargetRef.current.dispatchEvent(new Event("input")));
        }}
      />
      <TextInput
        id={`${definition.controlId}ExactInput`}
        className="scientific-slider-exact"
        labelText="Exact value"
        size="sm"
        value={exactValue}
        disabled={configuration.disabled}
        onChange={(event) => setExactValue(event.currentTarget.value)}
        onBlur={(event) => commitExactValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitExactValue(event.currentTarget.value);
        }}
      />
    </div>
  );
}

export function scientificSliderDefinitions() {
  return definitions;
}

export function ScientificSliderRoot({ definition }: { definition: ScientificSliderDefinition }) {
  return <ScientificSlider definition={definition} />;
}

export function scientificSliderControl(id: string) {
  return controls.get(id) ?? null;
}

export function setScientificSliderLabel(id: string, labelText: string) {
  const control = controls.get(id);
  if (control) control.labelText = labelText;
}

export function installScientificSliderControls() {
  window.FdtdScientificControls = {
    get: scientificSliderControl,
    setLabel: setScientificSliderLabel,
  };
}
