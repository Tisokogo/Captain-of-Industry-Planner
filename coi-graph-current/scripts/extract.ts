import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";
import * as paths from './paths';

const location = 'https://wiki.coigame.com/index.php';
const params = new URLSearchParams({
  title: 'Special:CargoQuery',
  limit: '500',
  offset: '100',
  tables: 'RecipesImport',
  fields: '_pageName=Page,Version=Version,Building=Building,BuildingIcon=BuildingIcon,Unreleased=Unreleased,RecipeId=RecipeId,PowerMult=PowerMult,Input1Icon=Input1Icon,Input1Name=Input1Name,Input1Qty=Input1Qty,Input2Icon=Input2Icon,Input2Name=Input2Name,Input2Qty=Input2Qty,Input3Icon=Input3Icon,Input3Name=Input3Name,Input3Qty=Input3Qty,Input4Icon=Input4Icon,Input4Name=Input4Name,Input4Qty=Input4Qty,Input5Icon=Input5Icon,Input5Name=Input5Name,Input5Qty=Input5Qty,Input6Icon=Input6Icon,Input6Name=Input6Name,Input6Qty=Input6Qty,Time=Time,Output1Icon=Output1Icon,Output1Name=Output1Name,Output1Qty=Output1Qty,Output2Icon=Output2Icon,Output2Name=Output2Name,Output2Qty=Output2Qty,Output3Icon=Output3Icon,Output3Name=Output3Name,Output3Qty=Output3Qty,Output4Icon=Output4Icon,Output4Name=Output4Name,Output4Qty=Output4Qty,Output5Icon=Output5Icon,Output5Name=Output5Name,Output5Qty=Output5Qty,Output6Icon=Output6Icon,Output6Name=Output6Name,Output6Qty=Output6Qty',
  'max+display+chars': '300',
  'edit+link': 'yes'
})

const url = `${location}?${params.toString()}`;
const parser = new DOMParser();

////////////////////////////////////////////////////////////////////////////////

async function main() {
  let offset = 0;
  const limit = 500;
  let allRecipes: Record<string, string>[] = [];

  while (true) {
    params.set('offset', offset.toString());
    params.set('limit', limit.toString());
    const currentUrl = `${location}?${params.toString()}`;

    const response = await fetch(currentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    const doc = parser.parseFromString(data, 'text/html');
    const table = doc.querySelector('.cargoTable');

    const structure = table?.querySelector('thead tr');
    const recipes = Array.from(table?.querySelectorAll('tbody tr') || [])
      .map((row: Element) => {
        const cells = Array.from(row.querySelectorAll('td'));
        const recipe: Record<string, string> = {};
        cells.forEach((cell, index) => {
          const header = structure?.children[index].textContent?.trim() || '';
          recipe[header] = cell.textContent?.trim() || '';
        });
        return recipe;
      });

    if (recipes.length === 0) {
      break;
    }

    const cleanedRecipes = recipes.map(recipe => {
      const output: Record<string, string> = {};
      Object.entries(recipe).forEach(([key, value]) => {
        const cleanedKey = key.replace(/[^a-zA-Z0-9_]/g, '');
        const cleanedValue = value.replace(/[\n\r]+/g, ' ').trim();
        output[cleanedKey] = cleanedValue;
      });
      return output;
    });

    allRecipes.push(...cleanedRecipes);
    offset += limit;
  }

  const outfile = paths.resolve('data', 'recipes.json');
  await Deno.writeTextFile(outfile, JSON.stringify(allRecipes, null, 2));
}

main().catch(console.error);