import React, { useEffect, useState } from "npm:react";
import { createRoot } from "npm:react-dom/client";

import "./styles.css";
import recipesData from "../data/recipes.json" with { type: "json" };
import { ForceGraph } from "./components/ForceGraph.jsx";
import { DetailPanel } from "./components/DetailPanel.jsx";
import { Legend } from "./components/Legend.jsx";
import { processRecipesData } from "./utils/dataProcessor.js";
import { theme } from "./theme.js";

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);

  const handleNodeSelect = (node) => {
    setSelectedNode(node);
  };

  const handleClosePanel = () => {
    setSelectedNode(null);
  };

  const handleNodeLinkClick = (nodeName) => {
    const node = data?.nodes.find((n) =>
      n.id === nodeName || n.name === nodeName
    );
    if (node) {
      // If it's a cluster node, set up the proper display info
      if (node.type === "cluster") {
        setSelectedNode({
          ...node,
          displayInfo: {
            type: "cluster",
            nodeCount: node.clusteredNodes.length,
            nodes: node.clusteredNodes,
          },
        });
      } else {
        setSelectedNode(node);
      }
    }
  };

  useEffect(() => {
    try {
      const processedData = processRecipesData(recipesData, theme);
      setData(processedData);
      setLoading(false);
    } catch (err) {
      console.error("Error processing recipes data:", err);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Processing recipes data...</h2>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="error-container">
        <h2>Error processing data</h2>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="visualization-container">
        <ForceGraph
          data={data}
          selectedNode={selectedNode}
          onNodeSelect={handleNodeSelect}
        />
      </div>

      <div className="title-overlay">
        <img src="logo.png" alt="Logo" className="logo" />
        <h3>Recipe Graph</h3>
      </div>

      <Legend selectedNode={selectedNode} />

      <div className="overlay stats-overlay">
        Nodes: {data?.nodes.length} | Links: {data?.links.length}
      </div>

      <DetailPanel
        node={selectedNode}
        data={data}
        onClose={handleClosePanel}
        onNodeLinkClick={handleNodeLinkClick}
      />
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
