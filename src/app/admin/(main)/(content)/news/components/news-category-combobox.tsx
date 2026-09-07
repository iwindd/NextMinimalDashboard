"use client";

import type { NewsCategoryItem } from "@/servers/news-category/types";
import { Combobox, InputBase, Loader, useCombobox } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

type NewsCategoryComboboxProps = {
  value: string | null;
  initialCategory?: NewsCategoryItem | null;
  onChangeAction: (
    value: string | null,
    category: NewsCategoryItem | null,
  ) => void;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
};

export function NewsCategoryCombobox({
  value,
  initialCategory,
  onChangeAction,
  error,
  disabled = false,
  readOnly = false,
}: NewsCategoryComboboxProps) {
  const combobox = useCombobox();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<NewsCategoryItem[]>(
    initialCategory ? [initialCategory] : [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search, limit: "20" });
        const response = await fetch(
          `/api/admin/news/categories?${params.toString()}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) return;
        const result = (await response.json()) as {
          data: NewsCategoryItem[];
          nextCursor: string | null;
        };
        setItems(() => {
          const merged = [
            ...result.data,
            ...(initialCategory &&
            !result.data.some((item) => item.id === initialCategory.id)
              ? [initialCategory]
              : []),
          ];
          return merged.filter(
            (item, index, list) =>
              list.findIndex((candidate) => candidate.id === item.id) === index,
          );
        });
        setNextCursor(result.nextCursor);
      } catch (error) {
        if ((error as Error).name !== "AbortError")
          setItems((current) => current);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, initialCategory]);

  const selectedLabel =
    items.find((item) => item.id === value)?.name ??
    initialCategory?.name ??
    "เลือกหมวดหมู่";
  const options = useMemo(
    () =>
      items.map((item) => (
        <Combobox.Option
          value={item.id}
          key={item.id}
          active={item.id === value}
        >
          {item.name}
        </Combobox.Option>
      )),
    [items, value],
  );

  const loadMore = async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        limit: "20",
        cursor: nextCursor,
      });
      const response = await fetch(
        `/api/admin/news/categories?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const result = (await response.json()) as {
        data: NewsCategoryItem[];
        nextCursor: string | null;
      };
      setItems((current) => [
        ...current,
        ...result.data.filter(
          (item) => !current.some((existing) => existing.id === item.id),
        ),
      ]);
      setNextCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Combobox
      store={combobox}
      disabled={disabled}
      withinPortal
      onOptionSubmit={(option) => {
        if (disabled || readOnly) return;
        const category = items.find((item) => item.id === option) ?? null;
        onChangeAction(category?.id ?? null, category);
        setSearch("");
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          label="หมวดหมู่"
          placeholder="เลือกหมวดหมู่"
          value={combobox.dropdownOpened ? search : selectedLabel}
          onChange={(event) => {
            if (disabled || readOnly) return;
            setSearch(event.currentTarget.value);
            combobox.openDropdown();
          }}
          onClick={() => {
            if (!disabled && !readOnly) combobox.openDropdown();
          }}
          onFocus={() => {
            if (!disabled && !readOnly) combobox.openDropdown();
          }}
          disabled={disabled}
          readOnly={readOnly}
          rightSection={
            loading ? <Loader size={16} /> : <Combobox.Chevron />
          }
          error={error}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options
          mah={240}
          style={{ overflowY: "auto" }}
          onScroll={(event) => {
            const element = event.currentTarget;
            if (
              element.scrollHeight - element.scrollTop - element.clientHeight <
              40
            )
              void loadMore();
          }}
        >
          {options}
          {!loading && options.length === 0 ? (
            <Combobox.Empty>ไม่พบหมวดหมู่</Combobox.Empty>
          ) : null}
          {loading ? <Combobox.Empty>กำลังโหลด...</Combobox.Empty> : null}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
