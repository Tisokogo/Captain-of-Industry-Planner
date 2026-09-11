import React, { useEffect, useRef } from "npm:react";
import * as d3 from "npm:d3";
import { theme } from "../theme.js";
import {
  calculateConnections,
  calculateDepth,
  getSourceId,
  getTargetId,
} from "../utils/dataProcessor.js";

export function ForceGraph({ data, selectedNode, onNodeSelect }) {
  const svgRef = useRef();

  // Helper functions for managing highlight state
  const getNodeOpacity = (nodeData, hoveredNodeId, selectedNodeId) => {
    // If this is the selected node (details panel open), always highlight
    if (selectedNodeId && nodeData.id === selectedNodeId) {
      return theme.colors.highlight.opacity.full;
    }

    // If hovering over a node, apply hover highlighting rules
    if (hoveredNodeId) {
      if (nodeData.id === hoveredNodeId) {
        return theme.colors.highlight.opacity.full;
      }
      if (nodeData.isInternal) {
        return theme.colors.highlight.opacity.dimmed;
      }
      // Check if connected to hovered node
      const isConnected = data.links.some((linkData) => {
        if (linkData.type === "invisible") return false;
        const sourceId = getSourceId(linkData);
        const targetId = getTargetId(linkData);
        return (sourceId === hoveredNodeId && targetId === nodeData.id) ||
          (targetId === hoveredNodeId && sourceId === nodeData.id);
      });
      return isConnected
        ? theme.colors.highlight.opacity.full
        : theme.colors.highlight.opacity.dimmed;
    }

    // If a node is selected (details panel open), dim unconnected nodes
    if (selectedNodeId) {
      // Check if connected to selected node
      const isConnected = data.links.some((linkData) => {
        if (linkData.type === "invisible") return false;
        const sourceId = getSourceId(linkData);
        const targetId = getTargetId(linkData);
        return (sourceId === selectedNodeId && targetId === nodeData.id) ||
          (targetId === selectedNodeId && sourceId === nodeData.id);
      });
      return isConnected
        ? theme.colors.highlight.opacity.full
        : theme.colors.highlight.opacity.dimmed;
    }

    // Default state - full opacity
    return theme.colors.highlight.opacity.full;
  };

  const getClusterOpacity = (nodeData, hoveredNodeId, selectedNodeId) => {
    // If this is the selected node (details panel open), always highlight
    if (selectedNodeId && nodeData.id === selectedNodeId) {
      return theme.nodes.cluster.opacity;
    }

    // If hovering over a node, apply hover highlighting rules
    if (hoveredNodeId) {
      if (nodeData.id === hoveredNodeId) {
        return theme.nodes.cluster.opacity;
      }
      // Check if connected to hovered node
      const isConnected = data.links.some((linkData) => {
        if (linkData.type === "invisible") return false;
        const sourceId = getSourceId(linkData);
        const targetId = getTargetId(linkData);
        return (sourceId === hoveredNodeId && targetId === nodeData.id) ||
          (targetId === hoveredNodeId && sourceId === nodeData.id);
      });
      return isConnected
        ? theme.colors.highlight.opacity.full * theme.nodes.cluster.opacity
        : theme.colors.highlight.opacity.dimmed * theme.nodes.cluster.opacity;
    }

    // If a node is selected (details panel open), dim unconnected clusters
    if (selectedNodeId) {
      // Check if connected to selected node
      const isConnected = data.links.some((linkData) => {
        if (linkData.type === "invisible") return false;
        const sourceId = getSourceId(linkData);
        const targetId = getTargetId(linkData);
        return (sourceId === selectedNodeId && targetId === nodeData.id) ||
          (targetId === selectedNodeId && sourceId === nodeData.id);
      });
      return isConnected
        ? theme.nodes.cluster.opacity
        : theme.colors.highlight.opacity.dimmed * theme.nodes.cluster.opacity;
    }

    // Default state
    return theme.nodes.cluster.opacity;
  };

  const getLinkOpacity = (linkData, hoveredNodeId, selectedNodeId) => {
    const sourceId = getSourceId(linkData);
    const targetId = getTargetId(linkData);

    if (linkData.type === "invisible") return 0;

    // If details panel is open and link is connected to selected node, highlight it
    if (
      selectedNodeId &&
      (sourceId === selectedNodeId || targetId === selectedNodeId)
    ) {
      return theme.colors.highlight.opacity.full;
    }

    // If hovering and link is connected to hovered node, highlight it
    if (
      hoveredNodeId &&
      (sourceId === hoveredNodeId || targetId === hoveredNodeId)
    ) {
      return theme.colors.highlight.opacity.full;
    }

    // If hovering over some other node, fade non-connected links
    if (hoveredNodeId) {
      return theme.colors.highlight.opacity.faded;
    }

    // If a node is selected (details panel open), dim unconnected links
    if (selectedNodeId) {
      return theme.colors.highlight.opacity.faded;
    }

    // Default state
    return linkData.computedOpacity;
  };

  const getLinkWidth = (linkData, hoveredNodeId, selectedNodeId) => {
    const sourceId = getSourceId(linkData);
    const targetId = getTargetId(linkData);

    if (linkData.type === "invisible") return theme.links.width.default;

    // If details panel is open and link is connected to selected node, highlight it
    if (
      selectedNodeId &&
      (sourceId === selectedNodeId || targetId === selectedNodeId)
    ) {
      return theme.links.width.highlighted;
    }

    // If hovering and link is connected to hovered node, highlight it
    if (
      hoveredNodeId &&
      (sourceId === hoveredNodeId || targetId === hoveredNodeId)
    ) {
      return theme.links.width.highlighted;
    }

    // Default state
    return theme.links.width.normal;
  };

  useEffect(() => {
    if (!data || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = globalThis.innerWidth;
    const height = globalThis.innerHeight;

    svg.attr("width", width).attr("height", height);

    const g = svg.append("g");

    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const zoomToNode = (nodeData) => {
      const scale = 1;
      const effectiveWidth = selectedNode ? width - 350 : width;
      const x = -nodeData.x * scale + effectiveWidth / 2;
      const y = -nodeData.y * scale + height / 2;

      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
    };

    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip overlay")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", theme.colors.tooltip.background)
      .style("color", theme.colors.tooltip.text)
      .style("padding", "12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("font-family", theme.text.family)
      .style("max-width", "300px")
      .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.3)")
      .style("z-index", "1000")
      .style("pointer-events", "none");

    // Add arrow markers
    const defs = svg.append("defs");

    // Recipe node marker (larger radius)
    defs.append("marker")
      .attr("id", "arrowhead-recipe")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "context-stroke");

    // Material node marker (smaller radius)
    defs.append("marker")
      .attr("id", "arrowhead-material")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "context-stroke");

    // Cluster node marker (large radius)
    defs.append("marker")
      .attr("id", "arrowhead-cluster")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "context-stroke");

    const getNodeRadius = (node) => {
      if (node.type === "cluster") return 50;
      if (node.isInternal) return 6;
      return node.type === "recipe"
        ? theme.nodes.recipe.radius
        : theme.nodes.material.radius;
    };

    const { connectionsMap } = calculateConnections(data);
    const { depthMap } = calculateDepth(data);

    // Separate clustered and regular nodes
    const clusteredNodesData = data.nodes.filter((n) => n.type === "cluster");
    const regularNodesData = data.nodes.filter((n) => n.type !== "cluster");

    // Create positions for nodes inside clusters
    const allNodesWithPositions = [];

    // Add regular nodes
    regularNodesData.forEach((node) => {
      allNodesWithPositions.push(node);
    });

    // Add cluster nodes and their internal nodes
    clusteredNodesData.forEach((clusterNode) => {
      allNodesWithPositions.push(clusterNode);

      if (clusterNode.clusteredNodes) {
        clusterNode.clusteredNodes.forEach((internalNode, index) => {
          const angle = (Math.PI / 3) +
            (index / clusterNode.clusteredNodes.length) * 2 *
              Math.PI;
          const radius = 30;
          const internalNodeCopy = {
            ...internalNode,
            id: `${clusterNode.id}_internal_${internalNode.id}`,
            isInternal: true,
            parentCluster: clusterNode.id,
            offsetX: Math.cos(angle) * radius,
            offsetY: Math.sin(angle) * radius,
          };
          allNodesWithPositions.push(internalNodeCopy);
        });
      }
    });

    const simulation = d3.forceSimulation(allNodesWithPositions)
      .force(
        "link",
        d3.forceLink(data.links).id((d) => d.id).distance((d) => {
          if (d.type === "invisible") return 0;
          return 50;
        }),
      )
      .force(
        "charge",
        d3.forceManyBody().strength((d) => {
          const parentsConnections = data.links.flatMap(
            (link) => {
              const sourceId = getSourceId(link);
              const targetId = getTargetId(link);

              if ([sourceId, targetId].includes(d.id)) {
                return [sourceId, targetId];
              }

              return [];
            },
          ).reduce((acc, id) => {
            return acc + connectionsMap.get(id) || 0;
          }, 0);

          return parentsConnections * (d.type === "cluster" ? -20 : -4);
        }),
      )
      .force(
        "collision",
        d3.forceCollide().radius((d) => {
          if (d.type === "cluster") return 60;
          if (d.isInternal) return 8;
          return d.type === "recipe"
            ? theme.collision.recipe
            : theme.collision.material;
        }),
      )
      .force(
        "yLayer",
        d3.forceY().y((d) => {
          if (d.isInternal) return 0;
          const depth = depthMap.get(d.id) || 0;
          return depth * 20;
        }).strength((d) => d.isInternal ? 0 : 0.1),
      )
      .force(
        "x",
        d3.forceX().x(width / 2).strength(0.01),
      )
      .force(
        "y",
        d3.forceY().y(height / 2).strength(0.01),
      )
      .alphaDecay(0.01);

    const link = g.append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr(
        "stroke",
        (d) => d.type === "input" ? theme.links.input : theme.links.output,
      )
      .attr(
        "fill",
        (d) => d.type === "input" ? theme.links.input : theme.links.output,
      )
      .attr("stroke-width", theme.links.width.default)
      .attr("stroke-opacity", (d) => d.computedOpacity)
      .attr("marker-end", (d) => {
        if (d.type === "invisible") return "none";
        const targetId = getTargetId(d);
        const targetNode = allNodesWithPositions.find((node) =>
          node.id === targetId
        );
        if (targetNode && targetNode.type === "cluster") {
          return "url(#arrowhead-cluster)";
        }
        return targetNode && targetNode.type === "recipe"
          ? "url(#arrowhead-recipe)"
          : "url(#arrowhead-material)";
      })
      .attr("marker-end-fill", "#600");

    // First render cluster nodes
    const clusterNodeGroup = g.append("g").attr("class", "cluster-nodes");
    const _clusterNodes = clusterNodeGroup
      .selectAll("g")
      .data(allNodesWithPositions.filter((d) => d.type === "cluster"))
      .join("g")
      .call(
        d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended),
      );

    // Then render regular and internal nodes on top
    const regularNodeGroup = g.append("g").attr("class", "regular-nodes");
    const node = regularNodeGroup
      .selectAll("g")
      .data(allNodesWithPositions.filter((d) => d.type !== "cluster"))
      .join("g")
      .call(
        d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended),
      );

    // Combine all nodes for event handling
    const _allNodes = g.selectAll("g g");

    // Add circles to cluster nodes
    clusterNodeGroup.selectAll("g").append("circle")
      .attr("r", () => theme.nodes.cluster.radius)
      .attr("fill", theme.nodes.cluster.fill)
      .attr("stroke", "none")
      .attr("stroke-width", 0)
      .attr("opacity", theme.nodes.cluster.opacity)
      .on("click", function (event, d) {
        event.stopPropagation();
        onNodeSelect({
          ...d,
          displayInfo: {
            type: "cluster",
            nodeCount: d.clusteredNodes.length,
            nodes: d.clusteredNodes,
          },
        });
      })
      .on("mouseover", function (event, d) {
        const nodeData = d;
        const clusterInfo = nodeData.clusteredNodes.map((node) =>
          `<div style="margin: 2px 0; font-size: 11px;">${node.name} (${node.type})</div>`
        ).join("");

        const tooltipContent = `
          <div style="font-weight: bold; color: ${theme.colors.mediumGray}; margin-bottom: 8px;">🔗 Cluster: ${nodeData.clusteredNodes.length} nodes</div>
          <div style="margin-bottom: 4px;"><strong>Clustered nodes:</strong></div>
          ${clusterInfo}
          <div style="margin-top: 8px; font-size: 10px; color: ${theme.colors.lightGray};">
            These nodes have identical input/output connections
          </div>
        `;

        tooltip
          .style("visibility", "visible")
          .html(tooltipContent)
          .style("left", (event.pageX + 20) + "px")
          .style("top", (event.pageY - 20) + "px");

        // Move hovered node to front by re-appending it
        const hoveredNode = d3.select(this.parentNode);
        hoveredNode.raise();

        // Apply highlighting with new rules
        const hoveredNodeId = d.id;
        const selectedNodeId = selectedNode?.id;

        // Highlight connected links
        link
          .attr(
            "stroke-opacity",
            (linkData) =>
              getLinkOpacity(linkData, hoveredNodeId, selectedNodeId),
          )
          .attr(
            "stroke-width",
            (linkData) => getLinkWidth(linkData, hoveredNodeId, selectedNodeId),
          );

        // Highlight connected nodes
        node.select("circle")
          .attr(
            "opacity",
            (nodeData) =>
              getNodeOpacity(nodeData, hoveredNodeId, selectedNodeId),
          );

        node.select("text")
          .attr(
            "opacity",
            (nodeData) =>
              getNodeOpacity(nodeData, hoveredNodeId, selectedNodeId),
          );

        // Highlight other cluster nodes if connected
        clusterNodeGroup.selectAll("g").select("circle")
          .attr(
            "opacity",
            (nodeData) =>
              getClusterOpacity(nodeData, hoveredNodeId, selectedNodeId),
          );
      })
      .on("mouseout", function (_event, _d) {
        tooltip.style("visibility", "hidden");

        // Reset to selected node highlighting state
        const selectedNodeId = selectedNode?.id;

        // Reset all links to reflect selected node state or default
        link
          .attr(
            "stroke-opacity",
            (linkData) => getLinkOpacity(linkData, null, selectedNodeId),
          )
          .attr(
            "stroke-width",
            (linkData) => getLinkWidth(linkData, null, selectedNodeId),
          );

        // Reset all regular and internal nodes
        node.select("circle")
          .attr(
            "opacity",
            (nodeData) => getNodeOpacity(nodeData, null, selectedNodeId),
          );

        node.select("text")
          .attr(
            "opacity",
            (nodeData) => getNodeOpacity(nodeData, null, selectedNodeId),
          );

        // Reset cluster nodes
        clusterNodeGroup.selectAll("g").select("circle")
          .attr(
            "opacity",
            (nodeData) => getClusterOpacity(nodeData, null, selectedNodeId),
          );
      });

    // Add circles to regular and internal nodes
    node.append("circle")
      .attr(
        "r",
        (d) => {
          if (d.isInternal) return 6;
          return d.type === "recipe"
            ? theme.nodes.recipe.radius
            : theme.nodes.material.radius;
        },
      )
      .attr(
        "fill",
        (d) => {
          if (d.isInternal) {
            return d.originalType === "recipe" || d.type === "recipe"
              ? theme.nodes.recipe.fill
              : theme.nodes.material.fill;
          }
          return d.type === "recipe"
            ? theme.nodes.recipe.fill
            : theme.nodes.material.fill;
        },
      )
      .attr("stroke", theme.nodes.stroke)
      .attr("stroke-width", theme.nodes.strokeWidth)
      .attr("fill-opacity", (d) => {
        if (d.isInternal) return 0.8;
        return 1;
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        if (!d.isInternal) {
          onNodeSelect(d);
          zoomToNode(d);
        }
      })
      .on("mouseover", function (event, d) {
        const nodeData = d;

        let tooltipContent = "";
        if (nodeData.isInternal) {
          tooltipContent = `
            <div style="font-weight: bold; color: ${
            nodeData.type === "recipe"
              ? theme.nodes.recipe.fill
              : theme.nodes.material.fill
          }; margin-bottom: 8px;">
              ${nodeData.type === "recipe" ? "📋" : "📦"} ${nodeData.name}
            </div>
            <div style="font-size: 10px; color: ${theme.colors.lightGray};">
              Part of cluster
            </div>
          `;
        } else if (nodeData.type === "recipe") {
          const inputs = data.links
            .filter((link) => {
              const targetId = getTargetId(link);
              return targetId === nodeData.id && link.type === "input";
            })
            .map((link) => {
              const sourceId = getSourceId(link);
              return `<div style="margin: 2px 0;">${sourceId} <span style="color: ${theme.colors.gold};">(${link.qty})</span></div>`;
            })
            .join("");
          const outputs = data.links
            .filter((link) => {
              const sourceId = getSourceId(link);
              return sourceId === nodeData.id && link.type === "output";
            })
            .map((link) => {
              const targetId = getTargetId(link);
              return `<div style="margin: 2px 0;">${targetId} <span style="color: ${theme.colors.gold};">(${link.qty})</span></div>`;
            })
            .join("");

          tooltipContent = `
            <div style="font-weight: bold; color: ${theme.nodes.recipe.fill}; margin-bottom: 8px;">📋 Recipe: ${nodeData.name}</div>
            <div style="margin-bottom: 4px;"><strong>Building:</strong> ${nodeData.building}</div>
            <div style="margin-bottom: 8px;"><strong>Time:</strong> ${nodeData.time}s</div>
            ${
            inputs
              ? `<div style="margin-bottom: 4px;"><strong style="color: ${theme.links.input};">Inputs:</strong></div>${inputs}`
              : ""
          }
            ${
            outputs
              ? `<div style="margin-top: 8px; margin-bottom: 4px;"><strong style="color: ${theme.links.output};">Outputs:</strong></div>${outputs}`
              : ""
          }
          `;
        } else {
          const usedInRecipes = data.links
            .filter((link) => {
              const sourceId = getSourceId(link);
              return sourceId === nodeData.id && link.type === "input";
            })
            .map((link) => {
              const targetId = getTargetId(link);
              return `<div style="margin: 2px 0;">${
                targetId.replace("recipe_", "")
              }</div>`;
            })
            .join("");
          const producedByRecipes = data.links
            .filter((link) => {
              const targetId = getTargetId(link);
              return targetId === nodeData.id && link.type === "output";
            })
            .map((link) => {
              const sourceId = getSourceId(link);
              return `<div style="margin: 2px 0;">${
                sourceId.replace("recipe_", "")
              }</div>`;
            })
            .join("");

          tooltipContent = `
            <div style="font-weight: bold; color: ${theme.nodes.material.fill}; margin-bottom: 8px;">📦 Material: ${nodeData.name}</div>
            ${
            usedInRecipes
              ? `<div style="margin-bottom: 4px;"><strong style="color: ${theme.links.input};">Used in recipes:</strong></div>${usedInRecipes}`
              : `<div style="color: ${theme.colors.lightGray};">Not used in any recipes</div>`
          }
            ${
            producedByRecipes
              ? `<div style="margin-top: 8px; margin-bottom: 4px;"><strong style="color: ${theme.links.output};">Produced by recipes:</strong></div>${producedByRecipes}`
              : `<div style="color: ${theme.colors.lightGray}; margin-top: 4px;">Not produced by any recipes</div>`
          }
          `;
        }

        tooltip
          .style("visibility", "visible")
          .html(tooltipContent)
          .style("left", (event.pageX + 20) + "px")
          .style("top", (event.pageY - 20) + "px");

        // Move hovered node to front by re-appending it
        const hoveredNode = d3.select(this.parentNode);
        hoveredNode.raise();

        // Apply highlighting with new rules
        const hoveredNodeId = d.id;
        const selectedNodeId = selectedNode?.id;

        // Highlight connected links
        link
          .attr(
            "stroke-opacity",
            (linkData) =>
              getLinkOpacity(linkData, hoveredNodeId, selectedNodeId),
          )
          .attr(
            "stroke-width",
            (linkData) => getLinkWidth(linkData, hoveredNodeId, selectedNodeId),
          );

        // Highlight connected nodes
        node.select("circle")
          .attr(
            "opacity",
            (nodeData) =>
              getNodeOpacity(nodeData, hoveredNodeId, selectedNodeId),
          );

        node.select("text")
          .attr(
            "opacity",
            (nodeData) =>
              getNodeOpacity(nodeData, hoveredNodeId, selectedNodeId),
          );

        // Highlight cluster nodes if connected
        clusterNodeGroup.selectAll("g").select("circle")
          .attr(
            "opacity",
            (nodeData) =>
              getClusterOpacity(nodeData, hoveredNodeId, selectedNodeId),
          );
      })
      .on("mouseout", function (_event, _d) {
        tooltip.style("visibility", "hidden");

        // Reset to selected node highlighting state
        const selectedNodeId = selectedNode?.id;

        // Reset all links to reflect selected node state or default
        link
          .attr(
            "stroke-opacity",
            (linkData) => getLinkOpacity(linkData, null, selectedNodeId),
          )
          .attr(
            "stroke-width",
            (linkData) => getLinkWidth(linkData, null, selectedNodeId),
          );

        // Reset all regular and internal nodes
        node.select("circle")
          .attr(
            "opacity",
            (nodeData) => getNodeOpacity(nodeData, null, selectedNodeId),
          );

        node.select("text")
          .attr(
            "opacity",
            (nodeData) => getNodeOpacity(nodeData, null, selectedNodeId),
          );

        // Reset cluster nodes
        clusterNodeGroup.selectAll("g").select("circle")
          .attr(
            "opacity",
            (nodeData) => getClusterOpacity(nodeData, null, selectedNodeId),
          );
      });

    // Add text labels to cluster nodes
    clusterNodeGroup.selectAll("g").append("text")
      .text((d) => d.name)
      .attr("font-size", "12px")
      .attr("font-family", theme.text.family)
      .attr("text-anchor", "middle")
      .attr("dy", 65)
      .attr("fill", theme.text.fill)
      .attr("font-weight", "bold")
      .style("pointer-events", "none");

    // Add text labels to regular and internal nodes
    node.append("text")
      .text((d) => {
        if (d.isInternal) return d.name;
        return d.name;
      })
      .attr(
        "font-size",
        (d) => {
          if (d.isInternal) return "8px";
          return d.type === "recipe"
            ? theme.text.size.recipe
            : theme.text.size.material;
        },
      )
      .attr("font-family", theme.text.family)
      .attr("text-anchor", "middle")
      .attr("dy", "14")
      .attr("fill", theme.text.fill)
      .attr("font-weight", (d) => {
        if (d.isInternal) return "normal";
        return d.type === "recipe" ? "bold" : "normal";
      })
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      // Update internal node positions relative to their cluster
      allNodesWithPositions.forEach((d) => {
        if (d.isInternal && d.parentCluster) {
          const clusterNode = allNodesWithPositions.find((n) =>
            n.id === d.parentCluster
          );
          if (clusterNode) {
            d.x = clusterNode.x + d.offsetX;
            d.y = clusterNode.y + d.offsetY;
          }
        }
      });

      link
        .attr("x1", (d) => {
          const sourceRadius = getNodeRadius(d.source);
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance === 0) return d.source.x;
          return d.source.x + (dx / distance) * sourceRadius;
        })
        .attr("y1", (d) => {
          const sourceRadius = getNodeRadius(d.source);
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance === 0) return d.source.y;
          return d.source.y + (dy / distance) * sourceRadius;
        })
        .attr("x2", (d) => {
          const targetRadius = getNodeRadius(d.target);
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance === 0) return d.target.x;
          return d.target.x - (dx / distance) * targetRadius;
        })
        .attr("y2", (d) => {
          const targetRadius = getNodeRadius(d.target);
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance === 0) return d.target.y;
          return d.target.y - (dy / distance) * targetRadius;
        });

      // Update cluster node positions
      clusterNodeGroup.selectAll("g")
        .attr("transform", (d) => `translate(${d.x},${d.y})`);

      // Update regular and internal node positions
      node
        .attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      if (!d.isInternal) {
        d.fx = d.x;
        d.fy = d.y;
      }
    }

    function dragged(event, d) {
      if (!d.isInternal) {
        d.fx = event.x;
        d.fy = event.y;
      }
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      if (!d.isInternal) {
        d.fx = null;
        d.fy = null;
      }
    }

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [data]);

  useEffect(() => {
    if (selectedNode && data) {
      // First try to find the node in the original data
      let nodeData = data.nodes.find((n) => n.id === selectedNode.id);

      // If not found and we have clustering, the node might be internal
      if (!nodeData && svgRef.current) {
        const svg = d3.select(svgRef.current);
        const allNodes = svg.selectAll("g g").data();
        nodeData = allNodes.find((n) => n.id === selectedNode.id);
      }

      if (nodeData && nodeData.x !== undefined && nodeData.y !== undefined) {
        const svg = d3.select(svgRef.current);
        const width = globalThis.innerWidth;
        const height = globalThis.innerHeight;
        const scale = 1;
        const effectiveWidth = width - 350;
        const x = -nodeData.x * scale + effectiveWidth / 2;
        const y = -nodeData.y * scale + height / 2;

        const zoom = d3.zoom()
          .scaleExtent([0.1, 4])
          .on("zoom", (event) => {
            svg.select("g").attr("transform", event.transform);
          });

        svg.transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
      }
    }

    // Apply highlighting based on selected node state
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const selectedNodeId = selectedNode?.id;

      // Update all links to reflect selected node state
      svg.selectAll("line")
        .attr(
          "stroke-opacity",
          (linkData) => getLinkOpacity(linkData, null, selectedNodeId),
        )
        .attr(
          "stroke-width",
          (linkData) => getLinkWidth(linkData, null, selectedNodeId),
        );

      // Update all regular and internal nodes
      svg.select(".regular-nodes").selectAll("g").select("circle")
        .attr(
          "opacity",
          (nodeData) => getNodeOpacity(nodeData, null, selectedNodeId),
        );

      svg.select(".regular-nodes").selectAll("g").select("text")
        .attr(
          "opacity",
          (nodeData) => getNodeOpacity(nodeData, null, selectedNodeId),
        );

      // Update cluster nodes
      svg.select(".cluster-nodes").selectAll("g").select("circle")
        .attr(
          "opacity",
          (nodeData) => getClusterOpacity(nodeData, null, selectedNodeId),
        );
    }
  }, [selectedNode, data]);

  return <svg ref={svgRef}></svg>;
}
