import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState,
  type ReactNode,
} from 'react';
import type {
  AppState, DayIndex, PantryItem, Performance, Profile, WeeklyCheckIn, WeightEntry,
} from '../types';
import { buildPlan, type PlanResult } from '../engine/planner';
import { clearPlanOverrides, createInitialState, demoState } from './state';
import { clearState, loadState, saveState } from './persistence';

/**
 * État global et cascade de recalcul.
 *
 * Toute modification passe par le reducer ; le plan complet (calories, macros,
 * séances, repas, courses) est ensuite recalculé de façon déterministe par
 * `buildPlan`. Changer le budget, la salle, le magasin ou un repas recalcule
 * donc automatiquement tout ce qui en dépend.
 */

type Action =
  | { type: 'reset' }
  | { type: 'loadDemo' }
  | { type: 'setState'; state: AppState }
  | { type: 'patchProfile'; patch: Partial<Profile> }
  | { type: 'completeOnboarding'; profile: Profile; pantry: PantryItem[] }
  | { type: 'setTargets'; targets: AppState['targetsOverride'] }
  | { type: 'setPantry'; pantry: PantryItem[] }
  | { type: 'replaceMeal'; day: DayIndex; index: number; recipeId: string }
  | { type: 'replaceExercise'; workoutId: string; index: number; exerciseId: string }
  | { type: 'setSwaps'; swaps: Record<string, string> }
  | { type: 'toggleChecked'; id: string }
  | { type: 'clearChecked' }
  | { type: 'setManualPrice'; productId: string; price: number }
  | { type: 'setPacks'; foodId: string; packs: number | null }
  | { type: 'logPerformance'; performance: Performance }
  | { type: 'deletePerformance'; id: string }
  | { type: 'logWeight'; entry: WeightEntry }
  | { type: 'logCheckIn'; checkIn: WeeklyCheckIn }
  | { type: 'setTheme'; theme: 'light' | 'dark' }
  | { type: 'regeneratePlan' };

/** Champs du profil dont la modification invalide les choix manuels. */
const STRUCTURAL_KEYS: (keyof Profile)[] = [
  'goal', 'storeId', 'diet', 'restrictions', 'allergies', 'dislikedFoods',
  'mealsPerDay', 'breakfast', 'weeklyBudget', 'weightKg', 'sessionsPerWeek',
];

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'reset':
      return createInitialState();

    case 'loadDemo':
      return demoState();

    case 'setState':
      return action.state;

    case 'patchProfile': {
      const profile = { ...state.profile, ...action.patch };
      const structural = STRUCTURAL_KEYS.some(
        (k) => JSON.stringify(action.patch[k]) !== undefined
          && JSON.stringify(action.patch[k]) !== JSON.stringify(state.profile[k]),
      );
      const next = { ...state, profile };
      // Un changement structurel rend caducs les repas et substitutions choisis.
      return structural ? { ...clearPlanOverrides(next), performances: state.performances } : next;
    }

    case 'completeOnboarding':
      return { ...state, profile: action.profile, pantry: action.pantry, onboarded: true };

    case 'setTargets':
      return { ...state, targetsOverride: action.targets };

    case 'setPantry':
      return { ...state, pantry: action.pantry };

    case 'replaceMeal':
      return {
        ...state,
        mealOverrides: { ...state.mealOverrides, [`${action.day}:${action.index}`]: action.recipeId },
      };

    case 'replaceExercise':
      return {
        ...state,
        exerciseOverrides: {
          ...state.exerciseOverrides,
          [`${action.workoutId}:${action.index}`]: action.exerciseId,
        },
      };

    case 'setSwaps':
      return { ...state, foodSwaps: action.swaps };

    case 'toggleChecked': {
      const set = new Set(state.checkedItems);
      if (set.has(action.id)) set.delete(action.id);
      else set.add(action.id);
      return { ...state, checkedItems: [...set] };
    }

    case 'clearChecked':
      return { ...state, checkedItems: [] };

    case 'setManualPrice':
      return { ...state, manualPrices: { ...state.manualPrices, [action.productId]: action.price } };

    case 'setPacks': {
      const packOverrides = { ...state.packOverrides };
      if (action.packs === null) delete packOverrides[action.foodId];
      else packOverrides[action.foodId] = Math.max(0, action.packs);
      return { ...state, packOverrides };
    }

    case 'logPerformance': {
      const performances = [
        ...state.performances.filter((p) => p.id !== action.performance.id),
        action.performance,
      ];
      return { ...state, performances };
    }

    case 'deletePerformance':
      return { ...state, performances: state.performances.filter((p) => p.id !== action.id) };

    case 'logWeight': {
      const rest = state.weightEntries.filter((w) => w.date !== action.entry.date);
      return { ...state, weightEntries: [...rest, action.entry].sort((a, b) => a.date.localeCompare(b.date)) };
    }

    case 'logCheckIn': {
      const rest = state.checkIns.filter((c) => c.date !== action.checkIn.date);
      return { ...state, checkIns: [...rest, action.checkIn] };
    }

    case 'setTheme':
      return { ...state, theme: action.theme };

    case 'regeneratePlan':
      return clearPlanOverrides(state);

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  plan: PlanResult;
  dispatch: (action: Action) => void;
  toast: string | null;
  notify: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => loadState() ?? createInitialState());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { saveState(state); }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.colorScheme = state.theme;
  }, [state.theme]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Recalcul complet et déterministe à chaque évolution de l'état.
  const plan = useMemo(() => buildPlan(state), [state]);

  const notify = useCallback((message: string) => setToast(message), []);

  const value = useMemo(
    () => ({ state, plan, dispatch, toast, notify }),
    [state, plan, toast, notify],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp doit être utilisé dans <AppProvider>');
  return ctx;
}

export { clearState };
