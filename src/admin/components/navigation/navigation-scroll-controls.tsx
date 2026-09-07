"use client";

import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
} from "@tabler/icons-react";
import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useState } from "react";
import classes from "./navigation-scroll-controls.module.css";

const SCROLL_TOLERANCE = 2;
const FALLBACK_STEP = 64;

type NavigationScrollControlsProps = {
  children: ReactNode;
  orientation: "horizontal" | "vertical";
  viewportRef: RefObject<HTMLDivElement | null>;
};

type ScrollState = {
  hasOverflow: boolean;
  atStart: boolean;
  atEnd: boolean;
};

export default function NavigationScrollControls({
  children,
  orientation,
  viewportRef,
}: NavigationScrollControlsProps) {
  const [scrollState, setScrollState] = useState<ScrollState>({
    hasOverflow: false,
    atStart: true,
    atEnd: true,
  });

  const isHorizontal = orientation === "horizontal";

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    const scrollPosition = isHorizontal
      ? viewport.scrollLeft
      : viewport.scrollTop;
    const viewportSize = isHorizontal
      ? viewport.clientWidth
      : viewport.clientHeight;
    const scrollSize = isHorizontal
      ? viewport.scrollWidth
      : viewport.scrollHeight;
    const maxScroll = Math.max(scrollSize - viewportSize, 0);

    setScrollState({
      hasOverflow: maxScroll > SCROLL_TOLERANCE,
      atStart: scrollPosition <= SCROLL_TOLERANCE,
      atEnd: scrollPosition >= maxScroll - SCROLL_TOLERANCE,
    });
  }, [isHorizontal, viewportRef]);

  const getMenuScrollTarget = useCallback(
    (direction: "backward" | "forward") => {
      const viewport = viewportRef.current;

      if (!viewport) return 0;

      const viewportRect = viewport.getBoundingClientRect();
      const currentPosition = isHorizontal
        ? viewport.scrollLeft
        : viewport.scrollTop;
      const viewportSize = isHorizontal
        ? viewport.clientWidth
        : viewport.clientHeight;
      const scrollSize = isHorizontal
        ? viewport.scrollWidth
        : viewport.scrollHeight;
      const maxScroll = Math.max(scrollSize - viewportSize, 0);
      const candidates = Array.from(
        viewport.querySelectorAll<HTMLElement>("a, button"),
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect();

          return rect.width > 0 && rect.height > 0;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();

          return isHorizontal
            ? rect.left - viewportRect.left + viewport.scrollLeft
            : rect.top - viewportRect.top + viewport.scrollTop;
        })
        .sort((a, b) => a - b);

      if (direction === "forward") {
        return (
          candidates.find(
            (position) => position > currentPosition + SCROLL_TOLERANCE,
          ) ?? Math.min(currentPosition + FALLBACK_STEP, maxScroll)
        );
      }

      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        const candidate = candidates[index];
        if (
          candidate !== undefined &&
          candidate < currentPosition - SCROLL_TOLERANCE
        ) {
          return candidate;
        }
      }

      return Math.max(currentPosition - FALLBACK_STEP, 0);
    },
    [isHorizontal, viewportRef],
  );

  const scrollToMenu = useCallback(
    (direction: "backward" | "forward") => {
      const viewport = viewportRef.current;

      if (!viewport) return;

      const target = getMenuScrollTarget(direction);

      viewport.scrollTo({
        left: isHorizontal ? target : viewport.scrollLeft,
        top: isHorizontal ? viewport.scrollTop : target,
        behavior: "smooth",
      });
    },
    [getMenuScrollTarget, isHorizontal, viewportRef],
  );

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    const content = viewport.firstElementChild;
    const resizeObserver = new ResizeObserver(updateScrollState);

    updateScrollState();
    viewport.addEventListener("scroll", updateScrollState, { passive: true });
    resizeObserver.observe(viewport);

    if (content) {
      resizeObserver.observe(content);
    }

    return () => {
      viewport.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState, viewportRef]);

  const StartIcon = isHorizontal ? IconChevronLeft : IconChevronUp;
  const EndIcon = isHorizontal ? IconChevronRight : IconChevronDown;
  const hideStart = !scrollState.hasOverflow || scrollState.atStart;
  const hideEnd = !scrollState.hasOverflow || scrollState.atEnd;

  return (
    <div className={classes.scrollControlsRoot} data-orientation={orientation}>
      {children}
      <button
        type="button"
        aria-label={isHorizontal ? "Scroll menu left" : "Scroll menu up"}
        className={`${classes.control} ${classes.controlStart}`}
        data-hidden={hideStart}
        data-orientation={orientation}
        disabled={hideStart}
        onClick={() => scrollToMenu("backward")}
      >
        <StartIcon size={18} stroke={2.4} />
      </button>
      <button
        type="button"
        aria-label={isHorizontal ? "Scroll menu right" : "Scroll menu down"}
        className={`${classes.control} ${classes.controlEnd}`}
        data-hidden={hideEnd}
        data-orientation={orientation}
        disabled={hideEnd}
        onClick={() => scrollToMenu("forward")}
      >
        <EndIcon size={18} stroke={2.4} />
      </button>
    </div>
  );
}
