"use client";

import { useEffect, useRef } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";
const HIDE_AFTER_MS = 700;

export function LandingScroll() {
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("landing-scroll");
    const thumb = thumbRef.current;
    const desktop = window.matchMedia(DESKTOP_QUERY);
    let hideTimer = 0;

    function hide() {
      thumb?.classList.remove("is-visible");
    }

    function onScroll() {
      if (!thumb || !desktop.matches) {
        hide();
        return;
      }
      const maxScroll = root.scrollHeight - root.clientHeight;
      if (maxScroll <= 1) {
        hide();
        return;
      }
      const height = Math.max(48, (root.clientHeight / root.scrollHeight) * root.clientHeight);
      const top = (window.scrollY / maxScroll) * (root.clientHeight - height);
      thumb.style.height = `${height}px`;
      thumb.style.transform = `translateY(${top}px)`;
      thumb.classList.add("is-visible");
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hide, HIDE_AFTER_MS);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    desktop.addEventListener("change", hide);
    return () => {
      root.classList.remove("landing-scroll");
      window.removeEventListener("scroll", onScroll);
      desktop.removeEventListener("change", hide);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div
      ref={thumbRef}
      aria-hidden="true"
      className="landing-scroll-thumb pointer-events-none fixed top-0 right-1 z-[60] hidden w-1.5 rounded-full bg-[#12304a]/45 transition-opacity duration-300 min-[1024px]:block"
    />
  );
}
