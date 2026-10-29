"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { faBell, faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { markAllNotificationsReadAction, markViewedNotificationsAction } from "./actions";
import "./bell.css";

export type BellItem = {
  id: string;
  title: string;
  href: string | null;
  read: boolean;
  preview?: string | null;
  when?: string;
};

export function NotificationBell({
  unread,
  href,
  items,
}: {
  unread: number;
  href: string;
  items: BellItem[];
}) {
  const router = useRouter();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState<{ top: number; right: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [cleared, setCleared] = useState(false);
  const unreadRef = useRef(unread);

  useEffect(() => {
    if (unreadRef.current === unread) return;
    unreadRef.current = unread;
    setCleared(false);
    setHidden(new Set());
  }, [unread]);
  const visible = cleared ? [] : items.filter((item) => !item.read && !hidden.has(item.id));
  const pending = items.filter((item) => !item.read && hidden.has(item.id)).length;
  const badge = cleared ? 0 : Math.max(0, unread - pending);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function place() {
      const narrow = window.matchMedia("(max-width: 1023px)").matches;
      setSheet(narrow);
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setBox(narrow ? { top: 0, right: 0 } : { top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    place();
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    if (window.matchMedia("(max-width: 1023px)").matches) document.body.style.overflow = "hidden";
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function hide(id: string) {
    setHidden((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }

  function restore(id: string) {
    setHidden((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function readOne(item: BellItem, follow: boolean) {
    hide(item.id);
    void markViewedNotificationsAction([item.id]).then((result) => {
      if (!result.ok) {
        restore(item.id);
        return;
      }
      router.refresh();
      if (follow && item.href) {
        setOpen(false);
        router.push(item.href);
      }
    });
  }

  function readAll() {
    setCleared(true);
    void markAllNotificationsReadAction().then((result) => {
      if (!result.ok) {
        setCleared(false);
        return;
      }
      router.refresh();
    });
  }

  const label = badge > 0 ? `Notifications, ${badge} unread` : "Notifications, none unread";
  const panel = open && mounted && box ? createPortal(
    <div
      ref={panelRef}
      className={sheet ? "bell-panel is-sheet" : "bell-panel"}
      role="dialog"
      aria-modal={sheet}
      aria-labelledby={titleId}
      tabIndex={-1}
      style={sheet ? undefined : { top: box.top, right: box.right }}
    >
      {sheet ? (
        <header className="bell-screen-bar">
          <button type="button" className="bell-screen-back" aria-label="Back" onClick={() => setOpen(false)}>
            <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
          </button>
          <div>
            <h2 id={titleId}>Notifications</h2>
            <p>{badge === 0 ? "You're all caught up" : `${badge} unread`}</p>
          </div>
          {badge > 0 ? (
            <button type="button" className="bell-screen-mark" onClick={readAll}>Mark all</button>
          ) : (
            <span className="bell-screen-mark" />
          )}
        </header>
      ) : (
        <header className="bell-head">
          <div>
            <h2 id={titleId}>Notifications</h2>
            <p>{badge === 0 ? "None unread" : `${badge} unread`}</p>
          </div>
          {badge > 0 ? (
            <button type="button" onClick={readAll}>Mark all as read</button>
          ) : null}
        </header>
      )}
      {visible.length === 0 ? (
        sheet ? (
          <div className="bell-screen-empty">
            <FontAwesomeIcon icon={faBell} aria-hidden="true" />
            <p>No notifications yet</p>
            <span>New notices will show up here.</span>
          </div>
        ) : (
          <p className="bell-empty">No new notifications.</p>
        )
      ) : (
        <ul className={sheet ? "bell-list bell-screen-list" : "bell-list"}>
          {visible.map((item) => (
            <li key={item.id}>
              {sheet ? (
                <button type="button" className="bell-screen-open" onClick={() => readOne(item, true)}>
                  <span className="bell-dot" aria-hidden="true" />
                  <span className="bell-screen-copy">
                    <strong>{item.title}</strong>
                    {item.preview ? <span>{item.preview}</span> : null}
                  </span>
                  {item.when ? <time>{item.when}</time> : null}
                </button>
              ) : (
                <div className="bell-row">
                  <button type="button" className="bell-open" onClick={() => readOne(item, true)}>
                    <strong>{item.title}</strong>
                    {item.preview ? <span>{item.preview}</span> : null}
                    {item.when ? <time>{item.when}</time> : null}
                  </button>
                  <button type="button" className="bell-read" onClick={() => readOne(item, false)}>Mark read</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {badge > visible.length ? <p className="bell-more">{badge - visible.length} more in your inbox.</p> : null}
      <Link className="bell-all" href={href} onClick={() => setOpen(false)}>See all notifications</Link>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="bell">
      <button
        ref={buttonRef}
        type="button"
        className="bell-button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <FontAwesomeIcon icon={faBell} aria-hidden="true" />
        {badge > 0 ? <span className="bell-count">{badge > 99 ? "99+" : badge}</span> : null}
      </button>
      {panel}
    </div>
  );
}
