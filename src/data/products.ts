import type { Product, PriceStatus } from '../types';
import { STORES } from './stores';
import { FOODS } from './foods';

/**
 * Référentiel produits.
 *
 * ⚠️ Tous les prix embarqués sont des PRIX DE DÉMONSTRATION, générés à partir
 * d'un prix de référence et d'un indice d'enseigne. Ils ne proviennent d'aucune
 * source actualisée et sont donc exposés avec le statut `estime` (ou `inconnu`
 * lorsqu'aucune référence n'existe). Le statut `verifie` est réservé aux prix
 * remontés par une source réelle — branchez-la dans `PRICE_SOURCES`.
 */

interface BaseProduct {
  foodId: string;
  label: string;
  packSize: number;
  packUnit: 'g' | 'ml' | 'piece';
  /** Prix de référence indicatif, avant application de l'indice enseigne. */
  basePrice: number | null;
  /** Enseignes ne référençant pas ce produit. */
  absentFrom?: string[];
}

const DEMO_SOURCE = 'Prix de démonstration — non actualisé';
const UNKNOWN_SOURCE = 'Aucune référence — saisis le prix';

export const BASE_PRODUCTS: BaseProduct[] = [
  // Protéines
  { foodId: 'poulet_filet', label: 'Filets de poulet', packSize: 1000, packUnit: 'g', basePrice: 9.49 },
  { foodId: 'dinde_escalope', label: 'Escalopes de dinde', packSize: 500, packUnit: 'g', basePrice: 5.79 },
  { foodId: 'boeuf_hache_5', label: 'Steaks hachés 5 %', packSize: 500, packUnit: 'g', basePrice: 6.95 },
  { foodId: 'boeuf_hache_15', label: 'Steaks hachés 15 %', packSize: 500, packUnit: 'g', basePrice: 4.49 },
  { foodId: 'porc_filet', label: 'Filet mignon de porc', packSize: 500, packUnit: 'g', basePrice: 7.20, absentFrom: [] },
  { foodId: 'jambon_blanc', label: 'Jambon blanc 4 tranches', packSize: 160, packUnit: 'g', basePrice: 2.35 },
  { foodId: 'jambon_dinde', label: 'Blanc de dinde 4 tranches', packSize: 160, packUnit: 'g', basePrice: 2.55 },
  { foodId: 'saumon_frais', label: 'Pavés de saumon x2', packSize: 260, packUnit: 'g', basePrice: 7.90 },
  { foodId: 'cabillaud', label: 'Dos de cabillaud x2', packSize: 250, packUnit: 'g', basePrice: 6.49 },
  { foodId: 'thon_boite', label: 'Thon au naturel 3x80 g', packSize: 240, packUnit: 'g', basePrice: 3.25 },
  { foodId: 'sardines_boite', label: 'Sardines à l\'huile 115 g', packSize: 115, packUnit: 'g', basePrice: 1.35 },
  { foodId: 'maquereau_boite', label: 'Maquereaux au naturel 160 g', packSize: 160, packUnit: 'g', basePrice: 1.85 },
  { foodId: 'oeuf', label: 'Œufs frais x12', packSize: 12, packUnit: 'piece', basePrice: 3.49 },
  { foodId: 'blanc_oeuf', label: 'Blancs d\'œufs liquides 500 ml', packSize: 500, packUnit: 'ml', basePrice: 3.60, absentFrom: ['aldi'] },
  { foodId: 'tofu_ferme', label: 'Tofu ferme nature 250 g', packSize: 250, packUnit: 'g', basePrice: 2.30 },
  { foodId: 'tempeh', label: 'Tempeh 200 g', packSize: 200, packUnit: 'g', basePrice: 3.60, absentFrom: ['lidl', 'aldi', 'intermarche'] },
  { foodId: 'seitan', label: 'Seitan nature 200 g', packSize: 200, packUnit: 'g', basePrice: 3.40, absentFrom: ['lidl', 'aldi'] },
  { foodId: 'crevettes', label: 'Crevettes décortiquées 200 g', packSize: 200, packUnit: 'g', basePrice: 4.95 },
  { foodId: 'colin_surgele', label: 'Filets de colin surgelés 600 g', packSize: 600, packUnit: 'g', basePrice: 5.40 },

  // Féculents
  { foodId: 'riz_blanc', label: 'Riz long grain 1 kg', packSize: 1000, packUnit: 'g', basePrice: 2.19 },
  { foodId: 'riz_complet', label: 'Riz complet 1 kg', packSize: 1000, packUnit: 'g', basePrice: 2.65 },
  { foodId: 'pates', label: 'Pâtes 500 g', packSize: 500, packUnit: 'g', basePrice: 1.05 },
  { foodId: 'pates_sans_gluten', label: 'Pâtes sans gluten 500 g', packSize: 500, packUnit: 'g', basePrice: 2.45, absentFrom: ['aldi'] },
  { foodId: 'semoule', label: 'Semoule de blé 500 g', packSize: 500, packUnit: 'g', basePrice: 1.25 },
  { foodId: 'quinoa', label: 'Quinoa 500 g', packSize: 500, packUnit: 'g', basePrice: 3.80 },
  { foodId: 'boulgour', label: 'Boulgour 500 g', packSize: 500, packUnit: 'g', basePrice: 1.95 },
  { foodId: 'pomme_terre', label: 'Pommes de terre 2,5 kg', packSize: 2500, packUnit: 'g', basePrice: 3.20 },
  { foodId: 'patate_douce', label: 'Patates douces 1 kg', packSize: 1000, packUnit: 'g', basePrice: 2.90 },
  { foodId: 'pain_complet', label: 'Pain de mie complet 500 g', packSize: 500, packUnit: 'g', basePrice: 1.65 },
  { foodId: 'pain_blanc', label: 'Baguette', packSize: 250, packUnit: 'g', basePrice: 0.95 },
  { foodId: 'flocons_avoine', label: 'Flocons d\'avoine 1 kg', packSize: 1000, packUnit: 'g', basePrice: 1.79 },
  { foodId: 'lentilles', label: 'Lentilles vertes 500 g', packSize: 500, packUnit: 'g', basePrice: 1.95 },
  { foodId: 'pois_chiches', label: 'Pois chiches 400 g (égoutté 265 g)', packSize: 265, packUnit: 'g', basePrice: 0.95 },
  { foodId: 'haricots_rouges', label: 'Haricots rouges 400 g', packSize: 265, packUnit: 'g', basePrice: 0.99 },
  { foodId: 'tortilla', label: 'Tortillas de blé x8', packSize: 8, packUnit: 'piece', basePrice: 1.75 },

  // Laitiers
  { foodId: 'fromage_blanc', label: 'Fromage blanc 3 % 1 kg', packSize: 1000, packUnit: 'g', basePrice: 2.29 },
  { foodId: 'skyr', label: 'Skyr nature 450 g', packSize: 450, packUnit: 'g', basePrice: 2.45 },
  { foodId: 'yaourt_grec', label: 'Yaourt grec 4x125 g', packSize: 500, packUnit: 'g', basePrice: 2.15 },
  { foodId: 'yaourt_soja', label: 'Yaourts soja 4x100 g', packSize: 400, packUnit: 'g', basePrice: 2.05, absentFrom: ['aldi'] },
  { foodId: 'lait_demi', label: 'Lait demi-écrémé 1 L', packSize: 1000, packUnit: 'ml', basePrice: 1.05 },
  { foodId: 'boisson_soja', label: 'Boisson soja 1 L', packSize: 1000, packUnit: 'ml', basePrice: 1.55 },
  { foodId: 'lait_amande', label: 'Boisson amande 1 L', packSize: 1000, packUnit: 'ml', basePrice: 1.75 },
  { foodId: 'mozzarella', label: 'Mozzarella 125 g', packSize: 125, packUnit: 'g', basePrice: 0.89 },
  { foodId: 'emmental', label: 'Emmental râpé 200 g', packSize: 200, packUnit: 'g', basePrice: 1.99 },
  { foodId: 'feta', label: 'Feta 200 g', packSize: 200, packUnit: 'g', basePrice: 2.30 },

  // Légumes & fruits
  { foodId: 'brocoli', label: 'Brocoli 500 g', packSize: 500, packUnit: 'g', basePrice: 1.99 },
  { foodId: 'courgette', label: 'Courgettes 1 kg', packSize: 1000, packUnit: 'g', basePrice: 2.20 },
  { foodId: 'poivron', label: 'Poivrons x3', packSize: 450, packUnit: 'g', basePrice: 2.45 },
  { foodId: 'tomate', label: 'Tomates 1 kg', packSize: 1000, packUnit: 'g', basePrice: 2.60 },
  { foodId: 'tomate_concassee', label: 'Tomates concassées 400 g', packSize: 400, packUnit: 'g', basePrice: 0.79 },
  { foodId: 'oignon', label: 'Oignons 1 kg', packSize: 1000, packUnit: 'g', basePrice: 1.65 },
  { foodId: 'echalote', label: 'Échalotes 500 g', packSize: 500, packUnit: 'g', basePrice: 2.10 },
  { foodId: 'ail', label: 'Ail 3 têtes', packSize: 150, packUnit: 'g', basePrice: 1.30 },
  { foodId: 'carotte', label: 'Carottes 1 kg', packSize: 1000, packUnit: 'g', basePrice: 1.35 },
  { foodId: 'epinards', label: 'Épinards frais 300 g', packSize: 300, packUnit: 'g', basePrice: 2.20 },
  { foodId: 'salade', label: 'Salade en sachet 150 g', packSize: 150, packUnit: 'g', basePrice: 1.45 },
  { foodId: 'champignons', label: 'Champignons de Paris 500 g', packSize: 500, packUnit: 'g', basePrice: 2.35 },
  { foodId: 'haricots_verts', label: 'Haricots verts surgelés 1 kg', packSize: 1000, packUnit: 'g', basePrice: 2.15 },
  { foodId: 'poelee_legumes', label: 'Poêlée de légumes surgelée 1 kg', packSize: 1000, packUnit: 'g', basePrice: 2.45 },
  { foodId: 'banane', label: 'Bananes (≈6)', packSize: 6, packUnit: 'piece', basePrice: 1.75 },
  { foodId: 'pomme', label: 'Pommes x6', packSize: 6, packUnit: 'piece', basePrice: 2.35 },
  { foodId: 'poire', label: 'Poires x6', packSize: 6, packUnit: 'piece', basePrice: 2.75 },
  { foodId: 'orange', label: 'Oranges x6', packSize: 6, packUnit: 'piece', basePrice: 2.65 },
  { foodId: 'fruits_rouges', label: 'Fruits rouges surgelés 450 g', packSize: 450, packUnit: 'g', basePrice: 3.25 },
  { foodId: 'citron', label: 'Citrons x4', packSize: 4, packUnit: 'piece', basePrice: 1.45 },

  // Épicerie
  { foodId: 'huile_olive', label: 'Huile d\'olive 750 ml', packSize: 750, packUnit: 'ml', basePrice: 6.45 },
  { foodId: 'huile_colza', label: 'Huile de colza 1 L', packSize: 1000, packUnit: 'ml', basePrice: 2.75 },
  { foodId: 'beurre_cacahuete', label: 'Beurre de cacahuète 350 g', packSize: 350, packUnit: 'g', basePrice: 2.95 },
  { foodId: 'amandes', label: 'Amandes 200 g', packSize: 200, packUnit: 'g', basePrice: 3.45 },
  { foodId: 'noix', label: 'Cerneaux de noix 150 g', packSize: 150, packUnit: 'g', basePrice: 3.20 },
  { foodId: 'whey', label: 'Whey protéine 1 kg', packSize: 1000, packUnit: 'g', basePrice: 24.90, absentFrom: ['lidl', 'aldi', 'intermarche', 'superu'] },
  { foodId: 'proteine_vegetale', label: 'Protéine de pois 1 kg', packSize: 1000, packUnit: 'g', basePrice: 22.50, absentFrom: ['lidl', 'aldi', 'intermarche', 'superu', 'leclerc'] },
  { foodId: 'miel', label: 'Miel 500 g', packSize: 500, packUnit: 'g', basePrice: 4.25 },
  { foodId: 'sirop_erable', label: 'Sirop d\'érable 250 g', packSize: 250, packUnit: 'g', basePrice: 4.80, absentFrom: ['aldi'] },
  { foodId: 'chocolat_noir', label: 'Chocolat noir 70 % 100 g', packSize: 100, packUnit: 'g', basePrice: 1.45 },
  { foodId: 'epices', label: 'Mélange d\'épices 40 g', packSize: 40, packUnit: 'g', basePrice: 1.20 },
  { foodId: 'curry', label: 'Curry en poudre 40 g', packSize: 40, packUnit: 'g', basePrice: 1.35 },
  { foodId: 'lait_coco', label: 'Lait de coco 400 ml', packSize: 400, packUnit: 'ml', basePrice: 1.55 },
  { foodId: 'creme_soja', label: 'Crème de soja 200 ml', packSize: 200, packUnit: 'ml', basePrice: 1.25, absentFrom: ['aldi'] },
  { foodId: 'sauce_soja', label: 'Sauce soja 150 ml', packSize: 150, packUnit: 'ml', basePrice: 1.85 },
  { foodId: 'moutarde', label: 'Moutarde 370 g', packSize: 370, packUnit: 'g', basePrice: 1.15 },
  // Prix volontairement absent : illustre le statut « prix inconnu ».
  { foodId: 'cafe', label: 'Café moulu 250 g', packSize: 250, packUnit: 'g', basePrice: null },
];

function roundPrice(n: number): number {
  // Arrondi au centime « psychologique » : .x9 / .x5 comme en magasin.
  const cents = Math.round(n * 100);
  const last = cents % 10;
  let adjusted = cents;
  if (last <= 2) adjusted = cents - last + 9 - 10;
  else if (last <= 7) adjusted = cents - last + 5;
  else adjusted = cents - last + 9;
  return Math.max(adjusted, 10) / 100;
}

function buildProducts(): Product[] {
  const out: Product[] = [];
  const knownFoods = new Set(FOODS.map((f) => f.id));
  for (const base of BASE_PRODUCTS) {
    if (!knownFoods.has(base.foodId)) {
      throw new Error(`Produit rattaché à un aliment inconnu : ${base.foodId}`);
    }
    for (const store of STORES) {
      if (base.absentFrom?.includes(store.id)) continue;
      const hasPrice = base.basePrice !== null;
      const price = hasPrice ? roundPrice(base.basePrice! * store.priceIndex) : 0;
      const status: PriceStatus = hasPrice ? 'estime' : 'inconnu';
      out.push({
        id: `${store.id}__${base.foodId}`,
        foodId: base.foodId,
        storeId: store.id,
        label: base.label,
        packSize: base.packSize,
        packUnit: base.packUnit,
        price,
        priceStatus: status,
        priceSource: hasPrice ? DEMO_SOURCE : UNKNOWN_SOURCE,
      });
    }
  }
  return out;
}

export const PRODUCTS: Product[] = buildProducts();

const BY_STORE_FOOD = new Map<string, Product>();
for (const p of PRODUCTS) BY_STORE_FOOD.set(`${p.storeId}__${p.foodId}`, p);

/** Produit correspondant à un aliment dans une enseigne, `null` si non référencé. */
export function findProduct(storeId: string, foodId: string): Product | null {
  return BY_STORE_FOOD.get(`${storeId}__${foodId}`) ?? BY_STORE_FOOD.get(`autre__${foodId}`) ?? null;
}

/** Prix au 100 g / 100 ml / pièce, utilisé par l'optimiseur de budget. */
export function unitPrice(product: Product): number {
  if (product.packUnit === 'piece') return product.price / product.packSize;
  return (product.price / product.packSize) * 100;
}
