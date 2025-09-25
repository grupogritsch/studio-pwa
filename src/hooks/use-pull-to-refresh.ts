import { useEffect, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPullDistance?: number;
  refreshingText?: string;
  pullText?: string;
  releaseText?: string;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPullDistance = 120,
  refreshingText = "Sincronizando...",
  pullText = "Puxe para sincronizar",
  releaseText = "Solte para sincronizar"
}: UsePullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0 && window.scrollY === 0) {
      e.preventDefault();
      const distance = Math.min(diff * 0.5, maxPullDistance);
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling || isRefreshing) return;

    setIsPulling(false);

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, isRefreshing, pullDistance, threshold]);

  const getIndicatorText = () => {
    if (isRefreshing) return refreshingText;
    if (pullDistance >= threshold) return releaseText;
    return pullText;
  };

  const shouldShowIndicator = isPulling || isRefreshing;

  return {
    containerRef,
    isRefreshing,
    pullDistance,
    isPulling,
    shouldShowIndicator,
    indicatorText: getIndicatorText(),
    indicatorOpacity: Math.min(pullDistance / threshold, 1),
    indicatorScale: Math.min(0.5 + (pullDistance / threshold) * 0.5, 1)
  };
}