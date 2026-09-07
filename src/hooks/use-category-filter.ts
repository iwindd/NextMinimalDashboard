"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CategoryFilterOption = {
  id: string;
  name: string;
};

type CategoryFilterResponse = {
  data?: CategoryFilterOption[];
  nextCursor?: string | null;
};

export type CategoryFilterController = {
  search: string;
  setSearch: (value: string) => void;
  options: CategoryFilterOption[];
  loading: boolean;
  loadMore: () => void;
  selectedIds: readonly string[];
  selectedOptions: CategoryFilterOption[];
};

type UseCategoryFilterOptions = {
  /** Admin categories endpoint, for example `/api/admin/news/categories`. */
  endpoint: string;
  selectedIds: readonly string[];
  /** Shown when a selected category cannot be resolved to a name. */
  unknownLabel?: string;
};

/**
 * Smallest maximum accepted by the admin category endpoints, so a single page
 * already covers the whole taxonomy of the modules without cursor support.
 */
const PAGE_LIMIT = 50;
const RESOLVE_MAX_PAGES = 10;
const SEARCH_DEBOUNCE_MS = 250;

async function fetchCategoryPage(
  endpoint: string,
  params: { search: string; limit: number; cursor?: string },
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams({
    search: params.search,
    limit: String(params.limit),
  });
  if (params.cursor) searchParams.set("cursor", params.cursor);

  const response = await fetch(`${endpoint}?${searchParams.toString()}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load categories (${response.status})`);
  }

  const result = (await response.json()) as CategoryFilterResponse;
  return {
    data: result.data ?? [],
    nextCursor: result.nextCursor ?? null,
  };
}

/**
 * Loads the category options of an admin content module for a multi-select
 * datatable filter. Names of selected categories are resolved even when the
 * selection is restored from the URL, so filter pills can be labelled.
 */
export default function useCategoryFilter({
  endpoint,
  selectedIds,
  unknownLabel = "หมวดหมู่ที่เลือก",
}: UseCategoryFilterOptions): CategoryFilterController {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<CategoryFilterOption[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const resolvedEndpointsRef = useRef(new Set<string>());
  const hasSelection = selectedIds.length > 0;

  const rememberNames = useCallback((items: CategoryFilterOption[]) => {
    if (items.length === 0) return;
    setNames((current) => {
      const next = { ...current };
      let changed = false;
      for (const item of items) {
        if (next[item.id] === item.name) continue;
        next[item.id] = item.name;
        changed = true;
      }
      return changed ? next : current;
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const page = await fetchCategoryPage(
          endpoint,
          { search, limit: PAGE_LIMIT },
          controller.signal,
        );
        setOptions(page.data);
        setCursor(page.nextCursor);
        rememberNames(page.data);
      } catch {
        // Keep the previously loaded options when a request fails or aborts.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, rememberNames, search]);

  // A selection restored from the URL is not necessarily part of the first
  // loaded page, so the taxonomy is paged through once to label every pill.
  useEffect(() => {
    if (!hasSelection) return;

    const resolvedEndpoints = resolvedEndpointsRef.current;
    if (resolvedEndpoints.has(endpoint)) return;
    resolvedEndpoints.add(endpoint);

    window.setTimeout(async () => {
      let pageCursor: string | undefined;
      for (let page = 0; page < RESOLVE_MAX_PAGES; page += 1) {
        try {
          const result = await fetchCategoryPage(endpoint, {
            search: "",
            limit: PAGE_LIMIT,
            cursor: pageCursor,
          });
          rememberNames(result.data);
          if (!result.nextCursor) return;
          pageCursor = result.nextCursor;
        } catch {
          return;
        }
      }
    }, 0);
  }, [endpoint, hasSelection, rememberNames]);

  const loadMore = useCallback(() => {
    if (!cursor || loading) return;
    const pageCursor = cursor;
    setLoading(true);
    void (async () => {
      try {
        const page = await fetchCategoryPage(endpoint, {
          search,
          limit: PAGE_LIMIT,
          cursor: pageCursor,
        });
        setOptions((current) => [
          ...current,
          ...page.data.filter(
            (item) => !current.some((existing) => existing.id === item.id),
          ),
        ]);
        setCursor(page.nextCursor);
        rememberNames(page.data);
      } catch {
        // Stop paginating silently; the already loaded options stay usable.
      } finally {
        setLoading(false);
      }
    })();
  }, [cursor, endpoint, loading, rememberNames, search]);

  const selectedOptions = useMemo(
    () =>
      selectedIds.map((categoryId) => ({
        id: categoryId,
        name: names[categoryId] ?? unknownLabel,
      })),
    [names, selectedIds, unknownLabel],
  );

  return {
    search,
    setSearch,
    options,
    loading,
    loadMore,
    selectedIds,
    selectedOptions,
  };
}
