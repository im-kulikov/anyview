import { Link } from 'react-router';

export function Stub({ name }: { name: string }) {
  return (
    <main style={{ padding: 16 }}>
      <h1>{name}</h1>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link to="/">Главная</Link>
        <Link to="/anime">Аниме</Link>
        <Link to="/series">Сериалы</Link>
        <Link to="/movies">Фильмы</Link>
        <Link to="/title/av-1">Тайтл</Link>
        <Link to="/search">Поиск</Link>
      </nav>
    </main>
  );
}
