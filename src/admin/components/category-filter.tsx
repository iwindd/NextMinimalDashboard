"use client";

import type { CategoryFilterController } from "@/hooks/use-category-filter";
import { Checkbox, Combobox, Group, Loader, useCombobox } from "@mantine/core";
import { FilterTrigger } from "./filter-trigger";

export type CategoryFilterProps = {
  filter: CategoryFilterController;
  onChangeAction: (categoryIds: string[]) => void;
  allLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  width?: number;
};

export function CategoryFilter({
  filter,
  onChangeAction,
  allLabel = "หมวดหมู่ทั้งหมด",
  searchPlaceholder = "ค้นหาหมวดหมู่",
  emptyLabel = "ไม่พบหมวดหมู่",
  width = 260,
}: CategoryFilterProps) {
  const combobox = useCombobox({
    onDropdownOpen: () => combobox.focusSearchInput(),
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      combobox.focusTarget();
      filter.setSearch("");
    },
  });
  const { loading, options, search, selectedIds, selectedOptions } = filter;
  const selected = new Set(selectedIds);

  const toggleCategory = (categoryId: string) => {
    onChangeAction(
      selected.has(categoryId)
        ? selectedIds.filter((current) => current !== categoryId)
        : [...selectedIds, categoryId],
    );
  };

  return (
    <Combobox
      store={combobox}
      position="bottom-start"
      width={width}
      shadow="md"
      onOptionSubmit={toggleCategory}
    >
      <Combobox.Target targetType="button">
        <FilterTrigger
          label={selectedOptions[0]?.name ?? allLabel}
          active={selectedIds.length > 0}
          opened={combobox.dropdownOpened}
          additionalCount={Math.max(selectedIds.length - 1, 0)}
          onClick={() => combobox.toggleDropdown()}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(event) => filter.setSearch(event.currentTarget.value)}
          placeholder={searchPlaceholder}
          rightSection={loading ? <Loader size={14} /> : null}
        />
        <Combobox.Options
          mah={240}
          style={{ overflowY: "auto" }}
          onScroll={(event) => {
            const element = event.currentTarget;
            const remaining =
              element.scrollHeight - element.scrollTop - element.clientHeight;
            if (remaining < 40) filter.loadMore();
          }}
        >
          {options.map((option) => (
            <Combobox.Option
              key={option.id}
              value={option.id}
              active={selected.has(option.id)}
            >
              <Group gap="sm" wrap="nowrap">
                <Checkbox.Indicator
                  size="xs"
                  checked={selected.has(option.id)}
                  aria-hidden
                />
                <span>{option.name}</span>
              </Group>
            </Combobox.Option>
          ))}
          {loading && options.length === 0 ? (
            <Combobox.Empty>กำลังโหลด...</Combobox.Empty>
          ) : null}
          {!loading && options.length === 0 ? (
            <Combobox.Empty>{emptyLabel}</Combobox.Empty>
          ) : null}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
