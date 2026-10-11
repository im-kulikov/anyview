import fc from 'fast-check';

/**
 * Общие настройки фаззинга (ADR-35). `FC_RUNS` — число прогонов на свойство (в `npm test` — 150, в ночном прогоне — тысячи),
 * `FC_SEED` — воспроизвести найденный сбой (сид печатается при падении). Сжатие (shrink) до минимального примера — автоматически.
 */
fc.configureGlobal({ numRuns: Number(process.env.FC_RUNS) || 150, ...(process.env.FC_SEED && { seed: Number(process.env.FC_SEED) }) });

export { fc };
