import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const SUFFIX = "AK Tools";
const TITLES: Record<string, string> = {
  "/": "Activation Key Editor",
  "/templates": "Templates",
  "/keys": "Keys Management",
};

export const MAIN_ID = "main-content";

/**
 * A single-page app does not reload, so screen reader users get no signal that the page
 * changed. Update the document title on every route, and move focus to the main region
 * after a navigation (not on the first load).
 */
export function useRouteEffects() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    const title = TITLES[pathname];
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById(MAIN_ID)?.focus();
  }, [pathname]);
}
