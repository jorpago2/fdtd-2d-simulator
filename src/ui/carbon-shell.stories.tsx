import type { Meta, StoryObj } from "@storybook/react-vite";
import { ApplicationHeader, SceneSearch, WorkflowNavigation } from "./carbon-shell";

function CarbonShellReference() {
  return (
    <div className="storybook-workbench cds--g10">
      <ApplicationHeader />
      <main className="storybook-workbench-content">
        <section aria-labelledby="workflow-reference-title">
          <h2 id="workflow-reference-title">Workflow navigation</h2>
          <nav className="scientific-tool-rail" aria-label="Simulation workflow">
            <WorkflowNavigation />
          </nav>
        </section>
        <section aria-labelledby="search-reference-title">
          <h2 id="search-reference-title">Scene search</h2>
          <SceneSearch />
        </section>
      </main>
    </div>
  );
}

const meta = {
  title: "FDTD/Carbon shell",
  component: CarbonShellReference,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CarbonShellReference>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reference: Story = {};
