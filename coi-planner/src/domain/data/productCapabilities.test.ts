import { describe, expect, it } from 'vitest';
import { availableDispositions, defaultState } from '../solver/planCalculator';
import { productCapabilities, products, recipes } from './gameData';

describe('generated product capability index', () => {
  it('covers every normalized product and references compatible recipes', () => {
    expect(Object.keys(productCapabilities).sort()).toEqual(Object.keys(products).sort());

    for (const [productId, capability] of Object.entries(productCapabilities)) {
      for (const recipeIds of Object.values(capability.routes)) {
        for (const recipeId of recipeIds) {
          const recipe = recipes[recipeId];
          expect(recipe, `${productId} -> ${recipeId}`).toBeDefined();
          expect(recipe.inputs.some((input) => input.id === productId)).toBe(true);
        }
      }
    }
  });

  it('keeps reviewed source and disposal anchors stable', () => {
    expect(productCapabilities.coal.extractable).toBe(true);
    expect(productCapabilities.coal.importable).toBe(true);
    expect(productCapabilities.coal.tradeable).toBe(true);
    expect(productCapabilities.coal.cargoCompatible).toBe(true);
    expect(productCapabilities.coal.transportTypes).toContain('loose');
    expect(productCapabilities.coal.storageFacilities[0].capacity).toBeGreaterThan(0);
    expect(productCapabilities.coal.unknownCapacity).toBe(true);
    expect(productCapabilities.diesel.routes.flare).toContain('diesel_disposal');
    expect(productCapabilities.waste_water.routes.dump).toContain('waste_water_dumping');
    expect(productCapabilities.waste_water.routes.wastewater).toContain('water_treatment');
  });

  it('only exposes routes that survive the active recipe filter', () => {
    const state = defaultState();
    state.recipeFilter!.disabledRecipeIds.push('diesel_disposal');

    const types = availableDispositions('diesel', state).map((option) => option.type);
    expect(types).not.toContain('flare');
    expect(types).toContain('storage');
    expect(types).toContain('further-processing');
  });
});
