import React from "npm:react";

export function DetailPanel({ node, data, onClose, onNodeLinkClick }) {
  if (!node) return null;

  const getSourceId = (link) =>
    typeof link.source === "object" ? link.source.id : link.source;
  const getTargetId = (link) =>
    typeof link.target === "object" ? link.target.id : link.target;

  const renderNodeLink = (nodeName, isRecipe = false) => {
    const displayName = isRecipe ? nodeName.replace("recipe_", "") : nodeName;
    return (
      <span
        className="node-link"
        onClick={() => onNodeLinkClick(nodeName)}
      >
        {displayName}
      </span>
    );
  };

  let content;
  if (node.displayInfo && node.displayInfo.type === "cluster") {
    // Handle cluster nodes
    const clusteredNodes = node.displayInfo.nodes;

    content = (
      <div>
        <div className="cluster-title">
          🔗 Cluster: {node.displayInfo.nodeCount} nodes
        </div>
        <div className="cluster-description">
          These nodes have identical input/output connections and have been grouped together.
        </div>
        <div className="cluster-section">
          <div className="cluster-section-title">
            Nodes in this cluster:
          </div>
          {clusteredNodes.map((clusterNode, index) => (
            <div key={index} className="cluster-node-item">
              <div
                className="cluster-node-header"
                onClick={() => onNodeLinkClick(clusterNode.id)}
                style={{ cursor: 'pointer' }}
              >
                <span className="cluster-node-type">
                  {clusterNode.type === "recipe" ? "📋" : "📦"}
                </span>
                <span className="cluster-node-name node-link">
                  {clusterNode.name}
                </span>
              </div>

              {clusterNode.type === "recipe" ? (
                <div className="cluster-recipe-full-details">
                  <div className="cluster-recipe-meta">
                    <div><strong>Building:</strong> {clusterNode.building}</div>
                    <div><strong>Time:</strong> {clusterNode.time}s</div>
                  </div>

                  {/* Show inputs for this recipe */}
                  {(() => {
                    const recipeInputs = data.links
                      .filter((link) => {
                        const targetId = getTargetId(link);
                        return targetId === node.id && link.type === "input";
                      })
                      .map((link) => {
                        const sourceId = getSourceId(link);
                        return (
                          <div key={sourceId} className="recipe-item">
                            {renderNodeLink(sourceId)}{" "}
                            <span className="recipe-qty">({link.qty})</span>
                          </div>
                        );
                      });

                    return recipeInputs.length > 0 ? (
                      <div className="cluster-recipe-section">
                        <div className="recipe-section-title inputs">Inputs:</div>
                        {recipeInputs}
                      </div>
                    ) : null;
                  })()}

                  {/* Show outputs for this recipe */}
                  {(() => {
                    const recipeOutputs = data.links
                      .filter((link) => {
                        const sourceId = getSourceId(link);
                        return sourceId === node.id && link.type === "output";
                      })
                      .map((link) => {
                        const targetId = getTargetId(link);
                        return (
                          <div key={targetId} className="recipe-item">
                            {renderNodeLink(targetId)}{" "}
                            <span className="recipe-qty">({link.qty})</span>
                          </div>
                        );
                      });

                    return recipeOutputs.length > 0 ? (
                      <div className="cluster-recipe-section">
                        <div className="recipe-section-title outputs">Outputs:</div>
                        {recipeOutputs}
                      </div>
                    ) : null;
                  })()}
                </div>
              ) : (
                <div className="cluster-material-full-details">
                  {/* Show material usage details */}
                  {(() => {
                    const usedInRecipes = data.links
                      .filter((link) => {
                        const sourceId = getSourceId(link);
                        return sourceId === node.id && link.type === "input";
                      })
                      .map((link) => {
                        const targetId = getTargetId(link);
                        return (
                          <div key={targetId} className="recipe-item">
                            {renderNodeLink(targetId, true)}
                          </div>
                        );
                      });

                    const producedByRecipes = data.links
                      .filter((link) => {
                        const targetId = getTargetId(link);
                        return targetId === node.id && link.type === "output";
                      })
                      .map((link) => {
                        const sourceId = getSourceId(link);
                        return (
                          <div key={sourceId} className="recipe-item">
                            {renderNodeLink(sourceId, true)}
                          </div>
                        );
                      });

                    return (
                      <>
                        {usedInRecipes.length > 0 ? (
                          <div className="cluster-material-section">
                            <div className="recipe-section-title inputs">Used in recipes:</div>
                            {usedInRecipes}
                          </div>
                        ) : (
                          <div className="material-empty">Not used in any recipes</div>
                        )}

                        {producedByRecipes.length > 0 ? (
                          <div className="cluster-material-section">
                            <div className="recipe-section-title outputs">Produced by recipes:</div>
                            {producedByRecipes}
                          </div>
                        ) : (
                          <div className="material-empty">Not produced by any recipes</div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  } else if (node.type === "recipe") {
    const inputs = data.links
      .filter((link) => {
        const targetId = getTargetId(link);
        return targetId === node.id && link.type === "input";
      })
      .map((link) => {
        const sourceId = getSourceId(link);
        return (
          <div key={sourceId} className="recipe-item">
            {renderNodeLink(sourceId)}{" "}
            <span className="recipe-qty">({link.qty})</span>
          </div>
        );
      });

    const outputs = data.links
      .filter((link) => {
        const sourceId = getSourceId(link);
        return sourceId === node.id && link.type === "output";
      })
      .map((link) => {
        const targetId = getTargetId(link);
        return (
          <div key={targetId} className="recipe-item">
            {renderNodeLink(targetId)}{" "}
            <span className="recipe-qty">({link.qty})</span>
          </div>
        );
      });

    content = (
      <div>
        <div className="recipe-title">
          📋 Recipe: {node.name}
        </div>
        <div className="recipe-building">
          <strong>Building:</strong> {node.building}
        </div>
        <div className="recipe-time">
          <strong>Time:</strong> {node.time}s
        </div>
        {inputs.length > 0 && (
          <div className="recipe-section">
            <div className="recipe-section-title inputs">
              Inputs:
            </div>
            {inputs}
          </div>
        )}
        {outputs.length > 0 && (
          <div>
            <div className="recipe-section-title outputs">
              Outputs:
            </div>
            {outputs}
          </div>
        )}
      </div>
    );
  } else {
    const usedInRecipes = data.links
      .filter((link) => {
        const sourceId = getSourceId(link);
        return sourceId === node.id && link.type === "input";
      })
      .map((link) => {
        const targetId = getTargetId(link);
        return (
          <div key={targetId} className="recipe-item">
            {renderNodeLink(targetId, true)}
          </div>
        );
      });

    const producedByRecipes = data.links
      .filter((link) => {
        const targetId = getTargetId(link);
        return targetId === node.id && link.type === "output";
      })
      .map((link) => {
        const sourceId = getSourceId(link);
        return (
          <div key={sourceId} className="recipe-item">
            {renderNodeLink(sourceId, true)}
          </div>
        );
      });

    content = (
      <div>
        <div className="material-title">
          📦 Material: {node.name}
        </div>
        {usedInRecipes.length > 0
          ? (
            <div className="recipe-section">
              <div className="recipe-section-title inputs">
                Used in recipes:
              </div>
              {usedInRecipes}
            </div>
          )
          : (
            <div className="material-empty">
              Not used in any recipes
            </div>
          )}
        {producedByRecipes.length > 0
          ? (
            <div>
              <div className="recipe-section-title outputs">
                Produced by recipes:
              </div>
              {producedByRecipes}
            </div>
          )
          : (
            <div className="material-empty last">
              Not produced by any recipes
            </div>
          )}
      </div>
    );
  }

  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <h3>Node Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="detail-panel-close"
        >
          ×
        </button>
      </div>
      {content}
    </div>
  );
}
