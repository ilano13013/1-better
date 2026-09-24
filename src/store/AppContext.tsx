import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState,
  type ReactNode,
} from 'react';
import type {
  AppState, DayIndex, PantryItem, Performance, Profile, WeeklyCheckIn, WeightEntry,
} from '../types';
import { buildPlan, type PlanResult } from '../engine/planner';
import { clearPlanOverrides, createInitialState, demoState } from './state';
import {
  LOCAL_ACCOUNT_ID, clearState, loadSealedState, loadState, saveSealedState, saveState,
} from './persistence';
import { loadSession, saveSession } from './session';
import type { Session } from '../engine/auth';
import { startSubscription, type BillingPeriod } from '../engine/entitlements';
import type { IntakeEntry } from '../engine/intake';

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
  | { type: 'toggleDriveAdded'; id: string }
  | { type: 'resetDrive' }
  | { type: 'setBrandLogo'; brandId: string; dataUrl: string | null }
  | { type: 'setRecipePhoto'; recipeId: string; dataUrl: string | null }
  | { type: 'logPerformance'; performance: Performance }
  | { type: 'deletePerformance'; id: string }
  | { type: 'logWeight'; entry: WeightEntry }
  | { type: 'logCheckIn'; checkIn: WeeklyCheckIn }
  | { type: 'setTheme'; theme: 'light' | 'dark' }
  | { type: 'subscribe'; period: BillingPeriod }
  | { type: 'unsubscribe' }
  | { type: 'logIntake'; entry: IntakeEntry }
  | { type: 'removeIntake'; id: string }
  | { type: 'setStartDate'; date: string }
  | { type: 'setTourSeen'; seen: boolean }
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

    // Changer de formule change ce que les moteurs calculent : tout repasse par
    // `buildPlan`, comme n'importe quelle autre modification structurelle.
    case 'subscribe':
      return {
        ...clearPlanOverrides(state),
        plan: 'plus',
        subscription: startSubscription(action.period),
      };

    case 'unsubscribe':
      return { ...clearPlanOverrides(state), plan: 'free', subscription: null };

    // Le journal ne touche pas au plan : pointer un repas ne le régénère pas.
    case 'logIntake':
      return { ...state, intake: [...state.intake, action.entry] };

    case 'removeIntake':
      return { ...state, intake: state.intake.filter((e) => e.id !== action.id) };

    // Le départ décide quels jours sont planifiés : le plan est reconstruit.
    case 'setStartDate':
      return { ...clearPlanOverrides(state), startDate: action.date };

    // Le guide ne touche à rien : il ne fait que se souvenir d'avoir été vu.
    case 'setTourSeen':
      return { ...state, tourSeen: action.seen };

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

    case 'toggleDriveAdded': {
      const set = new Set(state.driveAdded);
      if (set.has(action.id)) set.delete(action.id);
      else set.add(action.id);
      return { ...state, driveAdded: [...set] };
    }

    case 'resetDrive':
      return { ...state, driveAdded: [] };

    case 'setBrandLogo': {
      const brandLogos = { ...state.brandLogos };
      if (action.dataUrl) brandLogos[action.brandId] = action.dataUrl;
      else delete brandLogos[action.brandId];
      return { ...state, brandLogos };
    }

    case 'setRecipePhoto': {
      const recipePhotos = { ...state.recipePhotos };
      if (action.dataUrl) recipePhotos[action.recipeId] = action.dataUrl;
      else delete recipePhotos[action.recipeId];
      return { ...state, recipePhotos };
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
  /** Compte actif, ou `null` tant que personne n'a choisi sur l'écran d'accueil. */
  session: Session | null;
  /**
   * Compte e-mail de la dernière session, en attente de son mot de passe.
   * Sa clé de déchiffrement ne peut pas être conservée : elle défierait le
   * chiffrement. Il faut donc la redériver à chaque ouverture.
   */
  lockedSession: Session | null;
  /** Bascule sur un compte. `key` n'est fourni que pour un compte chiffré. */
  signIn: (session: Session, key?: CryptoKey | null) => Promise<void>;
  signOut: () => void;
  /** Efface les données du compte actif, sans toucher aux autres comptes. */
  eraseAccount: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Un compte e-mail rouvert repart verrouillé : son mot de passe est la seule
  // source de la clé, et rien ne permet de la conserver d'une visite à l'autre.
  const [stored] = useState(() => loadSession());
  const locked = stored?.provider === 'email' ? stored : null;

  const [session, setSession] = useState<Session | null>(locked ? null : stored);
  // La clé de stockage et la clé de chiffrement doivent suivre le compte *avant*
  // que le nouvel état ne soit enregistré : des refs garantissent cet ordre.
  const accountRef = useRef(session?.accountId ?? LOCAL_ACCOUNT_ID);
  const cryptoRef = useRef<CryptoKey | null>(null);
  const [state, dispatch] = useReducer(
    reducer, null, () => (locked ? null : loadState(accountRef.current)) ?? createInitialState(),
  );
  const [toast, setToast] = useState<string | null>(null);

  // Les écritures sont sérialisées : le chiffrement est asynchrone, deux
  // sauvegardes concurrentes pourraient s'écrire dans le désordre.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const persist = useCallback((value: AppState) => {
    queue.current = queue.current.then(async () => {
      const key = cryptoRef.current;
      if (key) await saveSealedState(value, accountRef.current, key);
      else saveState(value, accountRef.current);
    });
    return queue.current;
  }, []);

  useEffect(() => { void persist(state); }, [state, persist]);

  const switchTo = useCallback(async (next: Session | null, key: CryptoKey | null) => {
    await persist(state);                          // on ne perd pas la semaine en cours
    const id = next?.accountId ?? LOCAL_ACCOUNT_ID;
    accountRef.current = id;
    cryptoRef.current = key;
    saveSession(next);
    setSession(next);
    const loaded = key ? await loadSealedState(id, key) : loadState(id);
    dispatch({ type: 'setState', state: loaded ?? createInitialState() });
  }, [persist, state]);

  const signIn = useCallback(
    (next: Session, key: CryptoKey | null = null) => switchTo(next, key),
    [switchTo],
  );
  const signOut = useCallback(() => { void switchTo(null, null); }, [switchTo]);

  const eraseAccount = useCallback(() => {
    clearState(accountRef.current);
    dispatch({ type: 'reset' });
  }, []);

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
    () => ({
      state, plan, dispatch, toast, notify,
      session, lockedSession: locked, signIn, signOut, eraseAccount,
    }),
    [state, plan, toast, notify, session, locked, signIn, signOut, eraseAccount],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp doit être utilisé dans <AppProvider>');
  return ctx;
}

