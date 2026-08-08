import { useLayoutEffect, useRef, useState } from "react";
import { Slider } from "@carbon/react";

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
  mountId: string;
};

const definitions: ScientificSliderDefinition[] = [
  { mountId: "reactFrequencySliderRoot", controlId: "frequencyInput", initial: { labelText: "λs / λ₀", min: 0.25, max: 5, step: 0.01, value: 1, disabled: false } },
  { mountId: "reactAmplitudeSliderRoot", controlId: "amplitudeInput", labelId: "sourceAmplitudeLabel", initial: { labelText: "Jz,0", min: 5, max: 120, step: 5, value: 55, disabled: false } },
  { mountId: "reactSourceWidthSliderRoot", controlId: "sourceWidthInput", initial: { labelText: "FWHM / λ₀", min: 0.05, max: 1.5, step: 0.05, value: 0.35, disabled: true } },
  { mountId: "reactSourceAngleSliderRoot", controlId: "sourceAngleInput", initial: { labelText: "Jz axis θ", min: 0, max: 360, step: 1, value: 0, disabled: true } },
  { mountId: "reactSourceTimePhaseSliderRoot", controlId: "sourceTimePhaseInput", initial: { labelText: "phase φ", min: -180, max: 180, step: 1, value: 0, disabled: false } },
  { mountId: "reactMonitorLengthSliderRoot", controlId: "monitorLengthInput", initial: { labelText: "Length / λ₀", min: 0.1, max: 8, step: 0.05, value: 2, disabled: false } },
  { mountId: "reactMonitorAngleSliderRoot", controlId: "monitorAngleInput", initial: { labelText: "Angle θ", min: 0, max: 180, step: 1, value: 90, disabled: false } },
  { mountId: "reactBrushSizeSliderRoot", controlId: "brushMenuSizeInput", initial: { labelText: "Brush size", min: 0.05, max: 0.8, step: 0.05, value: 0.2, disabled: false } },
  { mountId: "reactSpeedSliderRoot", controlId: "speedInput", initial: { labelText: "Playback speed", min: 0.1, max: 10, step: 0.1, value: 1, disabled: false } },
  { mountId: "reactGainSliderRoot", controlId: "gainInput", initial: { labelText: "Display gain", min: 20, max: 260, step: 5, value: 100, disabled: false } },
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
  const configurationRef = useRef(configuration);
  configurationRef.current = configuration;

  const inputElement = () => document.getElementById(`${definition.controlId}-input-for-slider`) as HTMLInputElement | null;
  const update = (patch: Partial<SliderConfiguration>) => {
    const next = { ...configurationRef.current, ...patch };
    configurationRef.current = next;
    setConfiguration(next);
  };

  useLayoutEffect(() => {
    const controller = {
      addEventListener: ((...args: Parameters<HTMLElement["addEventListener"]>) => inputElement()?.addEventListener(...args)) as HTMLElement["addEventListener"],
      removeEventListener: ((...args: Parameters<HTMLElement["removeEventListener"]>) => inputElement()?.removeEventListener(...args)) as HTMLElement["removeEventListener"],
      dispatchEvent: ((event: Event) => inputElement()?.dispatchEvent(event) ?? false) as HTMLElement["dispatchEvent"],
      focus: ((options?: FocusOptions) => document.getElementById(definition.controlId)?.focus(options)) as HTMLElement["focus"],
    } as ScientificSliderControl;

    Object.defineProperties(controller, {
      value: {
        get: () => String(configurationRef.current.value),
        set: (value: string | number) => update({ value: numericValue(value, configurationRef.current.value) }),
      },
      min: {
        get: () => String(configurationRef.current.min),
        set: (value: string | number) => update({ min: numericValue(value, configurationRef.current.min) }),
      },
      max: {
        get: () => String(configurationRef.current.max),
        set: (value: string | number) => update({ max: numericValue(value, configurationRef.current.max) }),
      },
      step: {
        get: () => String(configurationRef.current.step),
        set: (value: string | number) => update({ step: value === "any" ? 0.01 : numericValue(value, configurationRef.current.step) }),
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
    <Slider
      id={definition.controlId}
      className="scientific-slider"
      min={configuration.min}
      max={configuration.max}
      step={configuration.step}
      value={configuration.value}
      disabled={configuration.disabled}
      hideTextInput
      labelText={<span id={definition.labelId}>{configuration.labelText}</span>}
      onChange={({ value }) => {
        const nextValue = numericValue(value as number, configurationRef.current.value);
        update({ value: nextValue });
        queueMicrotask(() => inputElement()?.dispatchEvent(new Event("input", { bubbles: true })));
      }}
    />
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
