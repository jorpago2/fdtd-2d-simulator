import { useSyncExternalStore } from "react";
import {
  Column,
  Dropdown,
  Grid,
  RadioTile,
  Tag,
  TileGroup,
} from "@carbon/react";

type SceneFilter = {
  count: number;
  disabled?: boolean;
  label: string;
  value: string;
};

type SceneRecord = {
  badges: string[];
  description: string;
  group: string;
  index: number | null;
  thumbnail: string;
  thumbnailSrc?: string;
  title: string;
  value: string;
};

type SceneFilterRenderOptions = {
  filters: SceneFilter[];
  onSelect: (value: string) => void;
  selectedValue: string;
  target: HTMLElement;
};

type SceneCardRenderOptions = {
  currentPreset: string;
  onSelect: (value: string) => void;
  records: SceneRecord[];
  target: HTMLElement;
};

type CarbonSceneBrowserApi = {
  closeDisclosures?: (root?: ParentNode) => void;
  renderSceneCards: (options: SceneCardRenderOptions) => void;
  renderSceneFilters: (options: SceneFilterRenderOptions) => void;
};

declare global {
  interface Window {
    FdtdCarbonUI?: CarbonSceneBrowserApi;
  }
}

type SceneFilterState = Omit<SceneFilterRenderOptions, "target"> | null;
type SceneCardState = Omit<SceneCardRenderOptions, "target"> | null;

let filterState: SceneFilterState = null;
let cardState: SceneCardState = null;
const filterListeners = new Set<() => void>();
const cardListeners = new Set<() => void>();

function subscribe(listeners: Set<() => void>, listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function sceneId(value: string) {
  return `scene-${value.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

function SceneFamilyFilter({ filters, onSelect, selectedValue }: Omit<SceneFilterRenderOptions, "target">) {
  const selectedItem = selectedValue
    ? filters.find((filter) => filter.value === selectedValue) ?? null
    : null;

  return (
    <Dropdown
      autoAlign
      id="sceneFamilyFilter"
      items={filters}
      itemToString={(item) => item ? `${item.label} (${item.count})` : ""}
      label="Select a scene family"
      onChange={({ selectedItem: nextItem }) => {
        if (nextItem && !nextItem.disabled) onSelect(nextItem.value);
      }}
      selectedItem={selectedItem}
      size="sm"
      titleText="Scene family"
    />
  );
}

function SceneCards({ currentPreset, onSelect, records }: Omit<SceneCardRenderOptions, "target">) {
  if (records.length === 0) {
    return <p className="scene-empty-state">No matching scenes. Clear the search and try another term.</p>;
  }

  return (
    <TileGroup
      className="scene-tile-group"
      legend="Available scenes"
      name="scene-preset"
      onChange={(value) => onSelect(String(value))}
      valueSelected={currentPreset}
    >
      <Grid className="scene-tile-grid" narrow fullWidth withRowGap>
        {records.map((record) => (
          <Column sm={4} md={8} lg={16} key={record.value}>
            <RadioTile
              className={`scene-card${record.value === currentPreset ? " is-active" : ""}`}
              id={sceneId(record.value)}
              value={record.value}
              {...{
                "aria-current": record.value === currentPreset ? "true" : undefined,
                "data-scene-card": record.value,
                "data-scene-thumb": record.thumbnail,
              }}
            >
              <span className="scene-card-layout">
                <span className="scene-card-thumb" aria-hidden="true">
                  {record.thumbnailSrc ? (
                    <img
                      className="scene-thumb-image"
                      src={record.thumbnailSrc}
                      alt=""
                      width={96}
                      height={96}
                      decoding="async"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : null}
                </span>
                <span className="scene-card-copy">
                  <span className="scene-card-header">
                    <Tag className="scene-card-number" size="sm" type="gray">{record.index ?? "–"}</Tag>
                    <strong className="scene-card-title">{record.title}</strong>
                  </span>
                  <span className="scene-card-group">{record.group}</span>
                  <span className="scene-card-description">{record.description || "Custom FDTD scene."}</span>
                  {record.badges.length > 0 ? (
                    <span className="scene-card-badges">
                      {record.badges.map((badge) => <Tag size="sm" type="gray" key={badge}>{badge}</Tag>)}
                    </span>
                  ) : null}
                </span>
              </span>
            </RadioTile>
          </Column>
        ))}
      </Grid>
    </TileGroup>
  );
}

export function SceneFilterBar() {
  const state = useSyncExternalStore(
    (listener) => subscribe(filterListeners, listener),
    () => filterState,
  );
  return (
    <div id="sceneFilterBar" className="scene-filter-bar">
      {state ? <SceneFamilyFilter {...state} /> : null}
    </div>
  );
}

export function SceneCardBrowser() {
  const state = useSyncExternalStore(
    (listener) => subscribe(cardListeners, listener),
    () => cardState,
  );
  return (
    <div id="sceneCards" className="scene-cards" aria-live="polite">
      {state ? <SceneCards {...state} /> : null}
    </div>
  );
}

export function installCarbonSceneBrowser() {
  window.FdtdCarbonUI = {
    renderSceneFilters({ target, ...options }) {
      target.dataset.selectedSceneFilter = options.selectedValue;
      target.dataset.zeroCountFilters = String(options.filters.filter((filter) => filter.count === 0).length);
      filterState = options;
      filterListeners.forEach((listener) => listener());
    },
    renderSceneCards({ target, ...options }) {
      cardState = options;
      cardListeners.forEach((listener) => listener());
    },
  };
}
