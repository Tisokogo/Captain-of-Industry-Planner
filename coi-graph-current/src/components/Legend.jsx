import React from "npm:react";
import { theme } from "../theme.js";

export function Legend({ selectedNode }) {
  return (
    <div className={`overlay legend-overlay ${selectedNode ? "with-panel" : ""}`}>
      <div className="legend-title">
        Legend:
      </div>
      <div className="legend-items">
        <div>
          <span style={{ color: theme.nodes.material.fill }}>●</span>{" "}
          Materials
        </div>
        <div>
          <span style={{ color: theme.nodes.recipe.fill }}>●</span> Recipes
        </div>
        <div>
          <span style={{ color: theme.links.input }}>→</span> Inputs
        </div>
        <div>
          <span style={{ color: theme.links.output }}>→</span> Outputs
        </div>
      </div>
      <div className="legend-help">
        Drag nodes to move them. Scroll to zoom. Hover over nodes for details.
        Click nodes to open detail panel.
      </div>
    </div>
  );
}
