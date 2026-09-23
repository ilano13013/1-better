import { useEffect, useRef, useState } from 'react';
import { useApp } from './store/AppContext';
import Splash from './screens/Splash';
import SignIn from './screens/SignIn';
import Onboarding from './screens/Onboarding';
import BuildingWeek from './screens/BuildingWeek';
import Dashboard from './screens/Dashboard';
import Week from './screens/Week';
import Training from './screens/Training';
import Nutrition from './screens/Nutrition';
import Shopping from './screens/Shopping';
import ProfileScreen from './screens/Profile';
import Coach from './screens/Coach';
import { IconBowl, IconCalendar, IconDumbbell, IconHome, IconUser, IconWhistle } from './components/icons';

export type Screen = 'home' | 'week' | 'training' | 'nutrition' | 'shopping' | 'coach' | 'profile';

const TABS: { id: Screen; label: string; icon: JSX.Element }[] = [
  { id: 'home', label: 'Accueil', icon: <IconHome /> },
  { id: 'week', label: 'Semaine', icon: <IconCalendar /> },
  { id: 'training', label: 'Training', icon: <IconDumbbell /> },
  { id: 'nutrition', label: 'Nutrition', icon: <IconBowl /> },
  { id: 'coach', label: 'Coach', icon: <IconWhistle /> },
  { id: 'profile', label: 'Profil', icon: <IconUser /> },
];

export default function App() {
  const { state, toast, session, lockedSession, signIn } = useApp();
  const [screen, setScreen] = useState<Screen>('home');
  const [splash, setSplash] = useState(true);
  const [building, setBuilding] = useState(false);

  // Le questionnaire vient d'être validé : on montre la construction du plan
  // avant le tableau de bord. Charger le profil de démonstration depuis
  // l'accueil passe par le même chemin.
  const wasOnboarded = useRef(state.onboarded);
  useEffect(() => {
    if (!wasOnboarded.current && state.onboarded) setBuilding(true);
    wasOnboarded.current = state.onboarded;
  }, [state.onboarded]);

  // Animation de lancement, avant toute décision.
  if (splash) {
    return <div className="app"><Splash onDone={() => setSplash(false)} /></div>;
  }

  // Personne n'a encore choisi entre un compte et l'usage local.
  if (!session) {
    return <div className="app"><SignIn onSignIn={signIn} locked={lockedSession} /></div>;
  }

  if (!state.onboarded) {
    return <div className="app"><Onboarding /></div>;
  }

  if (building) {
    return (
      <div className="app">
        <BuildingWeek onDone={() => setBuilding(false)} />
      </div>
    );
  }

  return (
    <div className="app">
      {screen === 'home' && <Dashboard go={setScreen} />}
      {screen === 'week' && <Week go={setScreen} />}
      {screen === 'training' && <Training go={setScreen} />}
      {screen === 'nutrition' && <Nutrition go={setScreen} />}
      {screen === 'shopping' && <Shopping go={setScreen} />}
      {screen === 'coach' && <Coach />}
      {screen === 'profile' && <ProfileScreen />}

      <nav className="tabbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={screen === tab.id || (screen === 'shopping' && tab.id === 'nutrition')}
            onClick={() => setScreen(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
