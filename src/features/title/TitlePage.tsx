import { useCallback, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Heart, Play, Star } from 'lucide-react';
import { ApiError, type Episode, type Source, type Title } from '../../api/contract';
import { useEpisodes, useTitle } from '../../api/hooks';
import { Cover } from '../../components/Cover';
import { ErrorState } from '../../components/ErrorState';
import { Skeleton } from '../../components/Skeleton';
import { NotFoundPage } from '../notfound/NotFoundPage';
import { Player, type PlayerHandle } from '../player/Player';
import { EpisodeList } from '../player/EpisodeList';
import { pickEpisode } from '../player/pickEpisode';
import { isResumable } from '../player/playerModel';
import { ExpandableText } from './ExpandableText';
import { S } from '../../lib/strings';
import { episodesText, formatLong, statusLabel, votesWord, formatNumber } from '../../lib/format';
import { favoritesStore, isFavorite, progressStore, toggleFavorite, useStore } from '../../lib/storage';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import styles from './TitlePage.module.css';

export function TitlePage() {
  const { id = '' } = useParams();
  return <TitleView key={id} id={id} />;
}

function TitleView({ id }: { id: string }) {
  const titleQ = useTitle(id);
  const epsQ = useEpisodes(id);
  useDocumentTitle(titleQ.data?.name);

  if (titleQ.error instanceof ApiError && titleQ.error.kind === 'not_found') return <NotFoundPage />;
  if (titleQ.isError) return <ErrorPage onRetry={() => void titleQ.refetch()} />;
  if (!titleQ.data) return <TitleSkeleton />;
  if (epsQ.isError && !(epsQ.error instanceof ApiError && epsQ.error.kind === 'not_found')) {
    return <ErrorPage onRetry={() => void epsQ.refetch()} />;
  }
  return <TitleBody title={titleQ.data} episodes={epsQ.data?.flatMap((s) => s.episodes)} episodesPending={epsQ.isPending} />;
}

function ErrorPage({ onRetry }: { onRetry(): void }) {
  return (
    <main className={styles.errPage}>
      <ErrorState onRetry={onRetry} />
      <Link to="/anime" className={styles.errLink}>{S.title.toCatalog}</Link>
    </main>
  );
}

function TitleBody({ title, episodes, episodesPending }: { title: Title; episodes?: Episode[]; episodesPending: boolean }) {
  const [params, setParams] = useSearchParams();
  const progress = useStore(progressStore);
  const favorites = useStore(favoritesStore);
  const playerRef = useRef<PlayerHandle>(null);
  const [source, setSource] = useState<Source | undefined>();
  const [picked, setPicked] = useState<string | null | undefined>(undefined);

  const list = episodes ?? [];
  // Серия выбирается один раз, когда плейлист загрузился: дальнейшие записи прогресса её не меняют.
  // null = выбор сделан, доступных серий нет (иначе рендер-фазовый setState зациклится).
  if (picked === undefined && !episodesPending) setPicked(pickEpisode(list, params.get('episode'), progress)?.id ?? null);
  const urlEp = list.find((e) => e.id === params.get('episode') && e.available);
  const current = urlEp ?? list.find((e) => e.id === picked);

  const select = useCallback((ep: Episode) => {
    setParams({ episode: ep.id }, { replace: true, preventScrollReset: true });
  }, [setParams]);

  const pick = useCallback((ep: Episode) => playerRef.current?.play(ep), []);

  const fav = isFavorite(favorites, title.id);
  const p = current ? progress[current.id] : undefined;
  const resuming = isResumable(p);
  const cta = !current ? S.title.watch : current.number === undefined ? S.title.watch : resuming ? S.title.continueEpisode(current.number) : S.title.watchEpisode(current.number);

  const meta = [formatLong(title.format), title.year, statusLabel(title.status)].filter(Boolean).join(' · ');
  const rating = title.rating;
  const info: [string, string | undefined][] = [
    [S.title.infoType, formatLong(title.format) || undefined],
    [S.title.infoEpisodes, title.format === 'movie' ? undefined : episodesText(title.episodes)],
    [S.title.infoYear, title.year ? String(title.year) : undefined],
    [S.title.infoStatus, statusLabel(title.status) || undefined],
    [S.title.infoDirector, title.credits.directors.join(', ') || undefined],
    [S.title.infoVoice, title.voiceovers.join(', ') || undefined],
  ];

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.bg} aria-hidden="true">
          <img src={(title.backdrop ?? title.poster)?.url} alt="" />
          <div />
        </div>
        <div className={styles.inner}>
          <nav aria-label={S.title.breadcrumbs} className={styles.crumbs}>
            <Link to="/anime">{S.nav.anime}</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{title.name}</span>
          </nav>
          <div className={styles.poster}>
            <Cover src={title.poster?.url} name={title.name} priority className={styles.posterCover} />
          </div>
          <div className={styles.right}>
            <div className={styles.head}>
              {meta && <p className={styles.meta}>{meta}</p>}
              <h1>{title.name}</h1>
              {title.originalName && <p className={styles.orig}>{title.originalName}</p>}
              {(rating || title.ageRating) && (
                <div className={styles.rate}>
                  {rating && (
                    <>
                      <b><Star size={16} fill="var(--star)" stroke="none" aria-hidden="true" />{rating.value.toFixed(1)}</b>
                      {rating.votes !== undefined && <span>{S.title.votes(formatNumber(rating.votes), votesWord(rating.votes))}</span>}
                    </>
                  )}
                  {title.ageRating && <span className={styles.age}>{title.ageRating}</span>}
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cta}
                disabled={!current}
                onClick={() => {
                  if (!current) return;
                  playerRef.current?.play(current); // синхронно: iOS разрешает play() только в обработчике касания
                  document.getElementById('player')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
                }}
              >
                <Play size={20} fill="currentColor" aria-hidden="true" />
                {cta}
              </button>
              <button
                type="button"
                className={styles.fav}
                aria-label={fav ? S.title.favorited : S.title.favorite}
                onClick={() => toggleFavorite(title)}
              >
                <Heart size={20} fill={fav ? 'currentColor' : 'none'} aria-hidden="true" />
                <span>{fav ? S.title.favorited : S.title.favorite}</span>
              </button>
            </div>

            <section className={styles.about}>
              <h2 className={styles.mobileOnly}>{S.title.about}</h2>
              <dl className={styles.info}>
                {info.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </section>

            {title.description && (
              <section className={styles.desc}>
                <h2 className={styles.mobileOnly}>{S.title.description}</h2>
                <ExpandableText text={title.description} />
              </section>
            )}

            {title.genres.length > 0 && (
              <ul aria-label={S.title.tags} className={styles.tags}>
                {title.genres.map((g) => <li key={g.id}>#{g.name}</li>)}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section id="player" className={styles.watch}>
        {episodesPending ? (
          <Skeleton className={styles.playerSkel} />
        ) : !current ? (
          <p className={styles.empty}>{S.title.noEpisodes}</p>
        ) : (
          <>
            <div className={styles.playerCol}>
              <div className={styles.watchHead}>
                <h2>{S.title.watch}</h2>
                <PlayerStatus current={current} source={source} />
              </div>
              <Player ref={playerRef} title={title} episodes={list} current={current} onSelect={select} onSourceChange={setSource} />
            </div>
            <aside aria-label={S.title.episodes} className={styles.aside}>
              <div className={styles.watchHead}>
                <h2>{S.title.episodes}</h2>
                <span>{S.title.released(list.filter((e) => e.available).length, title.episodes?.total ? `${title.episodes.total}${title.episodes.totalIsEstimate ? '+' : ''}` : String(list.filter((e) => e.available).length))}</span>
              </div>
              <div className={styles.listBox}>
                <EpisodeList title={title} episodes={list} currentId={current.id} onPick={pick} />
              </div>
            </aside>
          </>
        )}
      </section>
    </main>
  );
}

function PlayerStatus({ current, source }: { current: Episode; source: Source | undefined }) {
  const q = source ? `${source.quality.label} ${source.quality.height ?? ''}p` : '';
  return <span>{[current.name, q].filter(Boolean).join(' · ')}</span>;
}

function TitleSkeleton() {
  return (
    <main className={styles.main}>
      <div className={styles.skel}>
        <Skeleton className={styles.skelPoster} />
        <Skeleton style={{ width: '60%', height: 28, borderRadius: 8 }} />
        <Skeleton style={{ width: '40%', height: 16, borderRadius: 8 }} />
        <Skeleton className={styles.playerSkel} />
      </div>
    </main>
  );
}
