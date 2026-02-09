import { useState, useEffect } from "react";

/**
 * Returns `true` after the component has mounted on the client.
 * Used to defer Recharts rendering until after hydration + layout,
 * preventing SSR style-prop mismatches and ensuring containers
 * have valid dimensions.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: defer render to post-hydration
  useEffect(() => setMounted(true), []);
  return mounted;
}
