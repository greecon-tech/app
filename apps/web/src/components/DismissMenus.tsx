"use client";

import { useEffect } from "react";

/**
 * The menus that open from a button (the person's menu, a row's "More", the demo's role switch) are native disclosures, so they work with
 * the keyboard before any script has loaded. What a disclosure does not do is what a menu is expected to: close on Escape and give the
 * focus back to its button, and close when the person goes elsewhere. This does that, once, for every one of them on the page
 * (docs/29-apple-notion-standards.md: "Let people use the keyboard alone").
 */
const MENUS = "details.user-menu[open], details.row-menu[open]";

export function DismissMenus() {
  useEffect(() => {
    const open = () => Array.from(document.querySelectorAll<HTMLDetailsElement>(MENUS));
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      for (const menu of open()) {
        const hadFocus = menu.contains(document.activeElement);
        menu.open = false;
        if (hadFocus) menu.querySelector<HTMLElement>(":scope > summary")?.focus();
      }
    };
    const onElsewhere = (event: Event) => {
      for (const menu of open()) if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onElsewhere);
    document.addEventListener("focusin", onElsewhere);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onElsewhere);
      document.removeEventListener("focusin", onElsewhere);
    };
  }, []);

  return null;
}
