"use client";

import { useEffect, useRef, useState } from "react";

export function isContainerRenderable(width: number, height: number): boolean {
  return width > 0 && height > 0;
}

export function useContainerReady<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize((current) => {
        if (current.width === width && current.height === height) {
          return current;
        }
        return { width, height };
      });
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      update();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    ref,
    width: size.width,
    height: size.height,
    isReady: isContainerRenderable(size.width, size.height),
  };
}
