"use client";

import {
  Anchor,
  Badge,
  Group,
  Menu,
  ScrollArea,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconInfoCircle,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import classes from "./horizontal-menu.module.css";
import NavigationScrollControls from "./navigation-scroll-controls";
import {
  checkActiveChildren,
  formatNotificationCount,
  getLinkHref,
  getNavItems,
  getNotificationCount,
  isLinkItem,
  isParentItem,
  useFilteredNavGroups,
  useIsRouteActive,
  useNotifications,
  type NavItem,
} from "./navigation-utils";
import { useScrollbarVisibility } from "./use-scrollbar-visibility";

export default function HorizontalMenu() {
  const notifications = useNotifications();
  const viewportRef = useRef<HTMLDivElement>(null);
  const { hide, showThenHide, visible } = useScrollbarVisibility();
  const scrollbarClassName = `${classes.navigationScrollbar} ${visible ? classes.navigationScrollbarVisible : ""}`;
  const isActiveRoute = useIsRouteActive();
  const allItems = getNavItems(useFilteredNavGroups());

  const renderItemMeta = (item: NavItem) => {
    const notificationCount = getNotificationCount(
      notifications,
      item.notification,
    );

    if (notificationCount === 0 && !item.badge && !item.info) {
      return null;
    }

    return (
      <Group gap={6} wrap="nowrap" className={classes.horizontalItemMeta}>
        {item.info && (
          <Tooltip label={item.info} withArrow>
            <span className={classes.menuInfoIcon} aria-label={item.info}>
              <IconInfoCircle size={13} stroke={2} />
            </span>
          </Tooltip>
        )}
        {notificationCount > 0 && (
          <Badge variant="light" size="sm" circle>
            {formatNotificationCount(notificationCount)}
          </Badge>
        )}
        {item.badge && (
          <Badge
            color={item.badge.color ?? "cyan"}
            variant="light"
            size="xs"
            className={classes.badge}
          >
            {item.badge.label}
          </Badge>
        )}
      </Group>
    );
  };

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const handleHorizontalWheel = (event: WheelEvent) => {
      const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;

      if (maxScrollLeft <= 0) {
        return;
      }

      event.preventDefault();
      showThenHide();

      const dominantDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      const scrollDelta =
        event.deltaMode === 1
          ? dominantDelta * 16
          : event.deltaMode === 2
            ? dominantDelta * viewport.clientWidth
            : dominantDelta;

      if (scrollDelta === 0) {
        return;
      }

      viewport.scrollLeft = Math.min(
        Math.max(viewport.scrollLeft + scrollDelta, 0),
        maxScrollLeft,
      );
    };

    viewport.addEventListener("wheel", handleHorizontalWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      viewport.removeEventListener("wheel", handleHorizontalWheel, {
        capture: true,
      });
    };
  }, [showThenHide]);

  const renderMenuItems = (items: NavItem[]) =>
    items.map((item) => {
      const hasChildren = isParentItem(item);
      const itemMeta = renderItemMeta(item);
      const IconComponent = item.icon;
      const icon = IconComponent ? (
        <IconComponent size={16} stroke={1.8} />
      ) : undefined;

      if (hasChildren) {
        return (
          <Menu.Sub key={item.id} openDelay={100} closeDelay={100}>
            <Menu.Sub.Target>
              <Menu.Sub.Item
                disabled={item.disabled}
                leftSection={icon}
                rightSection={
                  <Group gap={6} wrap="nowrap">
                    {itemMeta}
                    <IconChevronRight size={14} stroke={1.8} />
                  </Group>
                }
              >
                {item.label}
              </Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown className={classes.horizontalMenuDropdown}>
              {renderMenuItems(item.items)}
            </Menu.Sub.Dropdown>
          </Menu.Sub>
        );
      }

      if (!isLinkItem(item)) {
        return (
          <Menu.Item
            key={item.id}
            leftSection={icon}
            rightSection={itemMeta}
            disabled
          >
            {item.label}
          </Menu.Item>
        );
      }

      const active = isActiveRoute(item.routeName);

      return (
        <Menu.Item
          key={item.id}
          component={Link}
          href={getLinkHref(item)}
          className={active ? classes.menuItemActive : undefined}
          data-active={active}
          aria-current={active ? "page" : undefined}
          leftSection={icon}
          rightSection={itemMeta}
        >
          {item.label}
        </Menu.Item>
      );
    });

  return (
    <nav className={classes.horizontalNavbar} aria-label="เมนูหลัก">
      <NavigationScrollControls
        orientation="horizontal"
        viewportRef={viewportRef}
      >
        <ScrollArea
          h="100%"
          className={classes.horizontalNavbarScroll}
          classNames={{
            scrollbar: scrollbarClassName,
            thumb: classes.navigationScrollbarThumb,
            viewport: classes.horizontalNavbarViewport,
          }}
          onMouseEnter={showThenHide}
          onMouseLeave={hide}
          onScrollPositionChange={showThenHide}
          scrollbars="x"
          scrollbarSize={10}
          scrollHideDelay={500}
          type="always"
          viewportRef={viewportRef}
        >
          <Group
            gap={4}
            className={classes.horizontalNavbarItems}
            pt="8"
            px="xs"
          >
            {allItems.map((item) => {
              const hasChildren = isParentItem(item);
              const isSelfActive = isLinkItem(item)
                ? isActiveRoute(item.routeName)
                : false;
              const isChildActive = hasChildren
                ? checkActiveChildren(item.items, isActiveRoute)
                : false;
              const isActive = isSelfActive || isChildActive;
              const IconComponent = item.icon;
              const itemMeta = renderItemMeta(item);

              if (hasChildren) {
                return (
                  <Menu
                    key={item.id}
                    trigger="click-hover"
                    closeOnItemClick
                    openDelay={100}
                    closeDelay={100}
                    position="bottom-start"
                    shadow="md"
                    width={220}
                    offset={14}
                  >
                    <Menu.Target>
                      <button
                        type="button"
                        className={classes.horizontalItem}
                        data-active={isActive}
                        data-disabled={item.disabled || undefined}
                        disabled={item.disabled}
                      >
                        {IconComponent && (
                          <IconComponent size={24} stroke={1.8} />
                        )}
                        <Text size="sm" fw={600}>
                          {item.label}
                        </Text>
                        {itemMeta}
                        <IconChevronDown size={16} stroke={1.8} />
                      </button>
                    </Menu.Target>
                    <Menu.Dropdown className={classes.horizontalMenuDropdown}>
                      {renderMenuItems(item.items)}
                    </Menu.Dropdown>
                  </Menu>
                );
              }

              if (!isLinkItem(item)) {
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-label={`${item.label} ยังไม่เปิดใช้งาน`}
                    className={classes.horizontalItem}
                    data-disabled
                    disabled
                  >
                    {IconComponent && <IconComponent size={24} stroke={1.8} />}
                    <Text size="sm" fw={600}>
                      {item.label}
                    </Text>
                    {itemMeta}
                  </button>
                );
              }

              return (
                <Anchor
                  key={item.id}
                  component={Link}
                  href={getLinkHref(item)}
                  className={classes.horizontalItem}
                  data-active={isSelfActive}
                  aria-current={isSelfActive ? "page" : undefined}
                  underline="never"
                >
                  {IconComponent && <IconComponent size={24} stroke={1.8} />}
                  <Text size="sm" fw={600}>
                    {item.label}
                  </Text>
                  {itemMeta}
                </Anchor>
              );
            })}
          </Group>
        </ScrollArea>
      </NavigationScrollControls>
    </nav>
  );
}
