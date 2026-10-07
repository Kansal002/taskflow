import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { EMPTY_FILTERS, filtersFromParams, filtersToParams, type CardFilters } from './filterCards';

/** Filters live in the URL (`?q=&label=&priority=&assignee=`) so a filtered view can be shared. */
export function useFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);

  const setFilters = useCallback(
    (update: Partial<CardFilters>) => {
      setParams((current) => filtersToParams({ ...filtersFromParams(current), ...update }, current), { replace: true });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [setFilters]);

  return { filters, setFilters, clearFilters };
}
