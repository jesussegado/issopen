import { useCallback, useEffect, useMemo, useRef } from "react";

export type RequestToken = Readonly<{ scope: string; sequence: number }>;

/**
 * Guards route reads against unmounts, scope changes and out-of-order replies.
 * Fetch cancellation remains the caller's responsibility because not every
 * request source accepts an AbortSignal.
 */
export function useLatestRequest(scope: string) {
  const state = useRef({
    scope,
    issued: 0,
    applied: 0,
    mounted: true,
  });
  state.current.scope = scope;

  useEffect(() => {
    state.current.mounted = true;
    return () => {
      state.current.mounted = false;
    };
  }, []);

  const begin = useCallback((): RequestToken => {
    const current = state.current;
    current.issued += 1;
    return { scope: current.scope, sequence: current.issued };
  }, []);

  const isCurrent = useCallback((token: RequestToken) => {
    const current = state.current;
    return (
      current.mounted &&
      token.scope === current.scope &&
      token.sequence >= current.applied
    );
  }, []);

  const accept = useCallback(
    (token: RequestToken) => {
      if (!isCurrent(token)) return false;
      state.current.applied = token.sequence;
      return true;
    },
    [isCurrent],
  );

  return useMemo(
    () => ({ begin, isCurrent, accept }),
    [accept, begin, isCurrent],
  );
}
