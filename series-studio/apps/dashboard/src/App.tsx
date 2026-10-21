import { Nav } from './components/Nav';
import { useRoute } from './router';
import { SeriesList } from './pages/SeriesList';
import { SeriesWizard } from './pages/SeriesWizard';
import { SeriesDetail } from './pages/SeriesDetail';
import { EpisodePage } from './pages/EpisodePage';
import { QueueCost } from './pages/QueueCost';
import { Settings } from './pages/Settings';

export function App() {
  const route = useRoute();
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 pb-24 pt-4">
      {route.name === 'series' && <SeriesList />}
      {route.name === 'new' && <SeriesWizard />}
      {route.name === 'detail' && <SeriesDetail id={route.id} {...(route.tab ? { tab: route.tab } : {})} />}
      {route.name === 'episode' && <EpisodePage id={route.id} n={route.n} {...(route.tab ? { tab: route.tab } : {})} />}
      {route.name === 'queue' && <QueueCost />}
      {route.name === 'settings' && <Settings />}
      <Nav route={route} />
    </div>
  );
}
