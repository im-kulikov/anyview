import { useRouteError } from 'react-router';
import { S } from '../lib/strings';
import { ErrorState } from '../components/ErrorState';

/** Глобальный errorElement маршрута: «Что-то пошло не так» + «Обновить». */
export function RouteError() {
  const err = useRouteError();
  if (import.meta.env.DEV) console.error(err);
  return (
    <main>
      <ErrorState title={S.boundary.title} hint={S.boundary.hint} onRetry={() => location.reload()} />
    </main>
  );
}
