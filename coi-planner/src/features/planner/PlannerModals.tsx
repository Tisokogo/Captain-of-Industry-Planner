import { useState } from 'react';
import { ChevronRight, Plus, Save, Search } from 'lucide-react';
import {
  iconMachine,
  iconProduct,
  isRecipeAllowed,
  machines,
  products,
  recipeOptions,
  recipeProgression,
  recipeTechTier,
  searchableProducts,
} from '../../domain/solver/planCalculator';
import { productName, tr, type Lang } from '../../i18n';
import { GameImage as Img } from '../../shared/GameImage';
import { Modal } from '../../shared/Modal';
import type { RecipeFilterState } from '../../types';

const allProducts = searchableProducts();

export function ProductPicker({
  lang,
  close,
  select,
}: {
  lang: Lang;
  close: () => void;
  select: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const list = allProducts.filter((p) =>
    (p.name + ' ' + productName(p.id, p.name, lang)).toLowerCase().includes(q.toLowerCase())
  );
  return (
    <Modal title={tr(lang, 'addProduct')} close={close}>
      <div className="search">
        <Search />
        <input
          autoFocus
          placeholder={tr(lang, 'searchProduct')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <kbd>{list.length}</kbd>
      </div>
      <div className="product-grid">
        {list.map((p) => (
          <button key={p.id} onClick={() => select(p.id)}>
            <Img src={iconProduct(p.id)} />
            <span>
              <b>{productName(p.id, p.name, lang)}</b>
              <small>
                {recipeOptions(p.id).length} {tr(lang, 'availableRecipes')}
              </small>
            </span>
            <Plus />
          </button>
        ))}
      </div>
    </Modal>
  );
}
export function RecipePicker({
  lang,
  productId,
  selected,
  filter,
  close,
  choose,
}: {
  lang: Lang;
  productId: string;
  selected?: string;
  filter: RecipeFilterState;
  close: () => void;
  choose: (id: string) => void;
}) {
  const p = products[productId];
  return (
    <Modal
      title={`${tr(lang, 'chooseRecipe')}: ${productName(productId, p.name, lang)}`}
      close={close}
    >
      <div className="recipe-cards">
        {recipeOptions(productId).map((r) => {
          const allowed = isRecipeAllowed(r, filter);
          return (
            <button
              disabled={!allowed}
              className={`${selected === r.id ? 'selected' : ''} ${!allowed ? 'recipe-disabled' : ''}`}
              onClick={() => allowed && choose(r.id)}
              key={r.id}
            >
              <div className="recipe-building">
                <Img src={iconMachine(r.machine)} />
                <span>
                  <b>{machines[r.machine]?.name}</b>
                  <small>{r.name}</small>
                </span>
                <em title={recipeProgression[r.id]?.unlockResearchName || ''}>
                  T{recipeTechTier(r)} · {r.duration}s
                </em>
              </div>
              <div className="recipe-flow">
                <span>
                  {r.inputs.map((x) => (
                    <i key={x.id}>
                      <Img src={iconProduct(x.id)} />
                      {x.quantity} {productName(x.id, products[x.id]?.name || x.name || x.id, lang)}
                    </i>
                  ))}
                </span>
                <ChevronRight />
                <span>
                  {r.outputs.map((x) => (
                    <i key={x.id}>
                      <Img src={iconProduct(x.id)} />
                      {x.quantity} {productName(x.id, products[x.id]?.name || x.name || x.id, lang)}
                    </i>
                  ))}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
export function SaveModal({
  lang,
  close,
  save,
}: {
  lang: Lang;
  close: () => void;
  save: (s: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <Modal title={tr(lang, 'savePlan')} close={close}>
      <div className="save-form">
        <label>
          {tr(lang, 'planName')}
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Electronics III — 12/min"
            onKeyDown={(e) => e.key === 'Enter' && name && save(name)}
          />
        </label>
        <div>
          <button className="soft" onClick={close}>
            {tr(lang, 'cancel')}
          </button>
          <button className="primary" disabled={!name} onClick={() => save(name)}>
            <Save />
            {tr(lang, 'savePlan')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
