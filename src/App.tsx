import { useState } from 'react';
import { useApp } from './store/AppContext';
import Onboarding from './screens/Onboarding';
import Dashboard from './screens/Dashboard';
import Week from './screens/Week';
import Training from './screens/Training';
import Nutrition from './screens/Nutrition';
import Shopping from './screens/Shopping';
import ProfileScreen from './screens/Profile';
import { IconBowl, IconCalendar, IconDumbbell, IconHome, IconUser } from './components/icons';

export type Screen = 'home' | 'week' | 'training' | 'nutrition' | 'shopping' | 'profile';

const TABS: { id: Screen; label: string; icon: JSX.Element }[] = [
  { id: 'home', label: 'Accueil', icon: <IconHome /> },
  { id: 'week', label: 'Semaine', icon: <IconCalendar /> },
  { id: 'training', label: 'Training', icon: <IconDumbbell /> },
  { id: 'nutrition', label: 'Nutrition', icon: <IconBowl /> },
  { id: 'profile', label: 'Profil', icon: <IconUser /> },
];

export default function App() {
  const { state, toast } = useApp();
  const [screen, setScreen] = useState<Screen>('home');

  if (!state.onboarded) {
    return <div className="app"><Onboarding /></div>;
  }

  return (
    <div className="app">
      {screen === 'home' && <Dashboard go={setScreen} />}
      {screen === 'week' && <Week go={setScreen} />}
      {screen === 'training' && <Training />}
      {screen === 'nutrition' && <Nutrition go={setScreen} />}
      {screen === 'shopping' && <Shopping go={setScreen} />}
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
