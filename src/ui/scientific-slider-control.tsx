import { scientificSliderDefinitions, ScientificSliderRoot } from "./scientific-sliders";

const sliders = new Map(scientificSliderDefinitions().map((definition) => [definition.controlId, definition]));

export function ScientificSlider({ controlId }: { controlId: string }) {
  const definition = sliders.get(controlId);
  if (!definition) throw new Error(`Unknown scientific slider: ${controlId}`);
  return <ScientificSliderRoot definition={definition} />;
}
