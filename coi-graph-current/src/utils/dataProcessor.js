export function processRecipesData(recipes, theme) {
  const nodes = new Map();
  const links = [];

  recipes.forEach((recipe) => {
    if (!recipe.RecipeId) return;

    const inputs = [];
    const outputs = [];

    for (let i = 1; i <= 6; i++) {
      const inputName = recipe[`Input${i}Name`];
      const inputQty = parseInt(recipe[`Input${i}Qty`]) || 0;
      const outputName = recipe[`Output${i}Name`];
      const outputQty = parseInt(recipe[`Output${i}Qty`]) || 0;

      if (inputName && inputQty > 0) {
        inputs.push({
          name: inputName,
          qty: inputQty,
          icon: recipe[`Input${i}Icon`],
        });
      }
      if (outputName && outputQty > 0) {
        outputs.push({
          name: outputName,
          qty: outputQty,
          icon: recipe[`Output${i}Icon`],
        });
      }
    }

    inputs.forEach((input) => {
      if (!nodes.has(input.name)) {
        nodes.set(input.name, {
          id: input.name,
          name: input.name,
          icon: input.icon,
          type: "material",
        });
      }
    });

    outputs.forEach((output) => {
      if (!nodes.has(output.name)) {
        nodes.set(output.name, {
          id: output.name,
          name: output.name,
          icon: output.icon,
          type: "material",
        });
      }
    });

    const recipeNodeId = `recipe_${recipe.RecipeId}`;
    nodes.set(recipeNodeId, {
      id: recipeNodeId,
      name: recipe.RecipeId,
      building: recipe.Building,
      type: "recipe",
      time: recipe.Time,
    });

    inputs.forEach((input) => {
      links.push({
        source: input.name,
        target: recipeNodeId,
        type: "input",
        qty: input.qty,
      });
    });

    outputs.forEach((output) => {
      links.push({
        source: recipeNodeId,
        target: output.name,
        type: "output",
        qty: output.qty,
      });
    });
  });

  // Create invisible links for recipes with 2+ shared inputs or outputs
  const recipeInputsOutputs = new Map();
  recipes.forEach((recipe) => {
    if (!recipe.RecipeId) return;

    const recipeItems = new Set();

    for (let i = 1; i <= 6; i++) {
      const inputName = recipe[`Input${i}Name`];
      const inputQty = parseInt(recipe[`Input${i}Qty`]) || 0;
      const outputName = recipe[`Output${i}Name`];
      const outputQty = parseInt(recipe[`Output${i}Qty`]) || 0;

      if (inputName && inputQty > 0) {
        recipeItems.add(inputName);
      }
      if (outputName && outputQty > 0) {
        recipeItems.add(outputName);
      }
    }

    recipeInputsOutputs.set(`recipe_${recipe.RecipeId}`, recipeItems);
  });

  // Find recipes with 2+ shared items
  const recipeIds = Array.from(recipeInputsOutputs.keys());
  for (let i = 0; i < recipeIds.length; i++) {
    for (let j = i + 1; j < recipeIds.length; j++) {
      const recipe1Items = recipeInputsOutputs.get(recipeIds[i]);
      const recipe2Items = recipeInputsOutputs.get(recipeIds[j]);

      const sharedItems = [...recipe1Items].filter(item => recipe2Items.has(item));

      if (sharedItems.length >= 3) {
        links.push({
          source: recipeIds[i],
          target: recipeIds[j],
          type: "invisible",
        });
      }
    }
  }

  let result = {
    nodes: Array.from(nodes.values()),
    links: links,
  };

  result = clusterNodes(result);
  result = preComputeLinkOpacities(result, theme);

  return result;
}

export function calculateConnections(data) {
  const _getSourceId = (link) =>
    typeof link.source === "object" ? link.source.id : link.source;
  const _getTargetId = (link) =>
    typeof link.target === "object" ? link.target.id : link.target;

  const connectionsMap = new Map();
  data.nodes.forEach((node) => {
    const connections = data.links.filter((link) =>
      (link.source === node.id || link.target === node.id) && link.type !== "invisible"
    ).length;
    connectionsMap.set(node.id, connections);
  });

  const inputCountMap = new Map();
  data.nodes.forEach((node) => {
    const inputCount = data.links.filter(
      (link) => link.target === node.id && link.type === "input",
    ).length;
    inputCountMap.set(node.id, inputCount);
  });

  const outputCountMap = new Map();
  data.nodes.forEach((node) => {
    const outputCount = data.links.filter(
      (link) => link.source === node.id && link.type === "output",
    ).length;
    outputCountMap.set(node.id, outputCount);
  });

  return {
    connectionsMap,
    inputCountMap,
    outputCountMap,
    maxConnections: Math.max(...connectionsMap.values()),
    maxInputCount: Math.max(...inputCountMap.values()),
    maxOutputCount: Math.max(...outputCountMap.values()),
  };
}

export function calculateDepth(data) {
  const _getSourceId = (link) =>
    typeof link.source === "object" ? link.source.id : link.source;
  const _getTargetId = (link) =>
    typeof link.target === "object" ? link.target.id : link.target;

  const depthMap = new Map();
  const visited = new Set();

  const walkGraph = (nodeId, depth, parentId) => {
    const visitKey = `${parentId}->${nodeId}`;
    if (visited.has(visitKey)) {
      return;
    }
    visited.add(visitKey);

    if (!depthMap.has(nodeId)) {
      depthMap.set(nodeId, depth);
    }

    depthMap.set(nodeId, Math.min(depthMap.get(nodeId), depth));

    const connectedLinks = data.links.filter(
      (link) => _getSourceId(link) === nodeId && link.type !== "invisible",
    );

    connectedLinks.forEach((link) => {
      const connectedNodeId = _getTargetId(link);
      walkGraph(connectedNodeId, depth + 1, nodeId);
    });
  };

  const roots = data.nodes.filter((d) =>
    d.type === "material" &&
    data.links.filter((l) => _getTargetId(l) == d.id && l.type !== "invisible").length === 0
  );

  roots.forEach((node) => {
    if (!depthMap.has(node.id)) {
      walkGraph(node.id, 0, null);
    }
  });

  return {
    depthMap,
    maxDepth: Math.max(...Array.from(depthMap.values())),
  };
}

export function clusterNodes(data) {
  const getConnectionSignature = (nodeId, links) => {
    const inputs = links
      .filter(link => link.target === nodeId && link.type !== "invisible")
      .map(link => `${link.source}:${link.type}`)
      .sort();

    const outputs = links
      .filter(link => link.source === nodeId && link.type !== "invisible")
      .map(link => `${link.target}:${link.type}`)
      .sort();

    return `inputs:[${inputs.join(',')}]|outputs:[${outputs.join(',')}]`;
  };

  const nodesBySignature = new Map();

  data.nodes.forEach(node => {
    const signature = getConnectionSignature(node.id, data.links);
    if (!nodesBySignature.has(signature)) {
      nodesBySignature.set(signature, []);
    }
    nodesBySignature.get(signature).push(node);
  });

  const clusteredNodes = [];
  const clusteredLinks = [];
  const nodeMapping = new Map();

  nodesBySignature.forEach((nodesGroup, _signature) => {
    if (nodesGroup.length === 1) {
      const node = nodesGroup[0];
      clusteredNodes.push(node);
      nodeMapping.set(node.id, node.id);
    } else {
      const clusterNodeId = `cluster_${nodesGroup.map(n => n.id).join('_')}`;
      const clusteredNode = {
        id: clusterNodeId,
        name: `Cluster (${nodesGroup.length} nodes)`,
        type: "cluster",
        clusteredNodes: nodesGroup,
        originalType: nodesGroup[0].type,
      };

      clusteredNodes.push(clusteredNode);

      nodesGroup.forEach(node => {
        nodeMapping.set(node.id, clusterNodeId);
      });
    }
  });

  const processedLinks = new Set();
  data.links.forEach(link => {
    const newSource = nodeMapping.get(link.source) || link.source;
    const newTarget = nodeMapping.get(link.target) || link.target;

    if (newSource === newTarget) {
      return;
    }

    const linkKey = `${newSource}->${newTarget}:${link.type}`;
    if (processedLinks.has(linkKey)) {
      return;
    }
    processedLinks.add(linkKey);

    clusteredLinks.push({
      ...link,
      source: newSource,
      target: newTarget,
    });
  });

  return {
    nodes: clusteredNodes,
    links: clusteredLinks,
  };
}

export const getSourceId = (link) =>
  typeof link.source === "object" ? link.source.id : link.source;
export const getTargetId = (link) =>
  typeof link.target === "object" ? link.target.id : link.target;

export function preComputeLinkOpacities(data, theme) {
  const { connectionsMap } = calculateConnections(data);

  data.links.forEach(link => {
    if (link.type === "invisible") {
      link.computedOpacity = 0;
    } else {
      const connections = (connectionsMap.get(getSourceId(link)) || 0) + (connectionsMap.get(getTargetId(link)) || 0);
      link.computedOpacity = Math.max(theme.links.opacity - (connections * 0.01), 0.1);
    }
  });

  return data;
}
