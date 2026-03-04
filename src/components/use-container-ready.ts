"use client";

import { useEffect, useRef, useState } from "react";

export function isContainerRenderable(width: number, height: number): boolean {
  return width > 0 && height > 0;
}

export function useContainerReady<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      setIsReady(isContainerRenderable(width, height));
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

  return { ref, isReady };
}
