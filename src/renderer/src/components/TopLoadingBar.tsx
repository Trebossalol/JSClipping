import { useMemo, useRef, type ReactNode } from "react";
import { LoadingBarContainer, useLoadingBar } from "react-top-loading-bar";

let pending = 0;

export function TopLoadingBar({ children }: { children: ReactNode }) {
  return (
    <LoadingBarContainer
      props={{
        color: "var(--primary)",
        height: 2,
        shadow: true,
        waitingTime: 300,
      }}
    >
      {children}
    </LoadingBarContainer>
  );
}

export function useTopLoader() {
  const { start, complete } = useLoadingBar();
  const startRef = useRef(start);
  const completeRef = useRef(complete);
  startRef.current = start;
  completeRef.current = complete;

  return useMemo(() => {
    const begin = () => {
      if (pending === 0) startRef.current();
      pending += 1;
    };
    const end = () => {
      if (pending === 0) return;
      pending -= 1;
      if (pending === 0) completeRef.current();
    };
    const wrap = async <T,>(task: () => Promise<T>): Promise<T> => {
      begin();
      try {
        return await task();
      } finally {
        end();
      }
    };
    return { begin, end, wrap };
  }, []);
}
