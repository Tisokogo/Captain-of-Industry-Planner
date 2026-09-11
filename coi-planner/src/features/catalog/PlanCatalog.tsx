import { useState } from 'react';
import { FolderOpen, Plus, Save, Search, Trash2 } from 'lucide-react';
import {
  iconMachine,
  iconProduct,
  isRecipeAllowed,
  machines,
  products,
  recipeOptions,
  recipeTechTier,
  searchableProducts,
} from '../../domain/solver/planCalculator';
import { productName, tr, type Lang } from '../../i18n';
import { GameImage as Img } from '../../shared/GameImage';
import type { PlanState, RecipeFilterState } from '../../types';

export type SavedPlan = { id: string; name: string; date: string; state: PlanState };
const allProducts = searchableProducts();

export function RecipeLibrary({
  lang,
  filter,
  onUse,
}: {
  lang: Lang;
  filter: RecipeFilterState;
  onUse: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const entries = allProducts
      .map((p) => ({ p, rs: recipeOptions(p.id).filter((r) => isRecipeAllowed(r, filter)) }))
      .filter((x) => x.rs.length > 0),
    list = entries.filter(({ p, rs }) =>
      (p.name + ' ' + rs.map((r) => r.name).join(' ')).toLowerCase().includes(q.toLowerCase())
    );
  return (
    <main className="library">
      <div className="library-head">
        <div>
          <span className="eyebrow">
            DATABASE · {list.length}/{entries.length} PRODUCTS · FILTER ACTIVE
          </span>
          <h1>{tr(lang, 'recipes')}</h1>
        </div>
        <div className="search">
          <Search />
          <input
            placeholder={tr(lang, 'searchRecipes')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="library-grid">
        {list.map(({ p, rs }) => (
          <article key={p.id}>
            <div className="lib-product">
              <Img src={iconProduct(p.id)} />
              <span>
                <h3>{productName(p.id, p.name, lang)}</h3>
                <small>
                  {rs.length} {tr(lang, 'availableRecipes')}
                </small>
              </span>
              <button
                aria-label={`${productName(p.id, p.name, lang)} ${lang === 'de' ? 'als Ziel' : 'as goal'}`}
                onClick={() => onUse(p.id)}
              >
                <Plus />
              </button>
            </div>
            {rs.map((r) => (
              <div className="lib-recipe" key={r.id}>
                <Img src={iconMachine(r.machine)} />
                <span>
                  <b>{machines[r.machine]?.name}</b>
                  <small>{r.name}</small>
                </span>
                <em>
                  T{recipeTechTier(r)} · {r.duration}s
                </em>
              </div>
            ))}
          </article>
        ))}
      </div>
    </main>
  );
}
export function Saved({
  lang,
  plans,
  load,
  remove,
}: {
  lang: Lang;
  plans: SavedPlan[];
  load: (p: SavedPlan) => void;
  remove: (id: string) => void;
}) {
  return (
    <main className="library">
      <div className="library-head">
        <div>
          <span className="eyebrow">LOCAL STORAGE</span>
          <h1>{tr(lang, 'savedPlans')}</h1>
        </div>
      </div>
      {!plans.length ? (
        <div className="empty saved-empty">
          <FolderOpen />
          <p>{tr(lang, 'noSaved')}</p>
        </div>
      ) : (
        <div className="saved-grid">
          {plans.map((p) => (
            <article key={p.id}>
              <div>
                <Save />
                <span>
                  <h3>{p.name}</h3>
                  <small>{new Date(p.date).toLocaleString(lang)}</small>
                </span>
              </div>
              <p>
                {p.state.goals.length} {tr(lang, 'goals')} ·{' '}
                {p.state.goals
                  .map((g) =>
                    productName(g.productId, products[g.productId]?.name || g.productId, lang)
                  )
                  .join(', ')}
              </p>
              <div>
                <button className="primary" onClick={() => load(p)}>
                  {tr(lang, 'load')}
                </button>
                <button
                  className="danger"
                  aria-label={tr(lang, 'delete')}
                  onClick={() => remove(p.id)}
                >
                  <Trash2 />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
