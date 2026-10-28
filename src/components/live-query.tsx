"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { forwardRef, useEffect, useRef, useState } from "react";

const SELECT_CLEARS = new Set(["", "ALL", "all"]);

function publish(router: ReturnType<typeof useRouter>, pathname: string, values: Record<string, string>, kinds: Record<string, "text" | "select" | "date">, replaceOnPage: boolean) {
  const here = window.location.pathname;
  const next = new URLSearchParams(here === pathname ? window.location.search : "");
  next.delete("page");
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim();
    const clear = kinds[key] === "select" ? SELECT_CLEARS.has(value) : value === "";
    if (clear) next.delete(key);
    else next.set(key, value);
  }
  const qs = next.toString();
  const url = qs ? `${pathname}?${qs}` : pathname;
  if (url === here + window.location.search) return;
  const go = replaceOnPage && here === pathname ? router.replace : router.push;
  go(url, { scroll: false });
}

export const LiveSearchInput = forwardRef<
  HTMLInputElement,
  { id?: string; name?: string; placeholder?: string; className?: string; destination: string; initial?: string }
>(function LiveSearchInput(props, ref) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) {
    return (
      <input
        ref={ref}
        id={props.id}
        name={props.name ?? "q"}
        className={props.className}
        placeholder={props.placeholder}
        defaultValue={props.initial ?? ""}
        autoComplete="off"
        aria-label={props.placeholder}
      />
    );
  }
  return <LiveSearchControl ref={ref} {...props} />;
});

const LiveSearchControl = forwardRef<
  HTMLInputElement,
  { id?: string; name?: string; placeholder?: string; className?: string; destination: string; initial?: string }
>(function LiveSearchControl({ id, name = "q", placeholder, className, destination, initial = "" }, ref) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  const typed = useRef(false);
  const current = pathname === destination ? search.get(name) ?? "" : "";

  useEffect(() => {
    if (focused || typed.current) return;
    setValue(current);
  }, [current, focused]);

  useEffect(() => {
    if (!typed.current) return;
    const handle = window.setTimeout(() => {
      typed.current = false;
      publish(router, destination, { [name]: value }, { [name]: "text" }, true);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [destination, name, router, value]);

  return (
    <input
      ref={ref}
      id={id}
      name={name}
      className={className}
      placeholder={placeholder}
      value={value}
      autoComplete="off"
      aria-label={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => {
        typed.current = true;
        setValue(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        typed.current = false;
        publish(router, destination, { [name]: value }, { [name]: "text" }, true);
      }}
    />
  );
});

export type QueryField = {
  name: string;
  label: string;
  kind: "text" | "select" | "date";
  value: string;
  placeholder?: string;
  labelClassName?: string;
  inputClassName?: string;
  srOnly?: boolean;
  options?: Array<{ value: string; label: string }>;
};

export function LiveQueryForm({ pathname, className, fields }: { pathname: string; className?: string; fields: QueryField[] }) {
  const router = useRouter();
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.name, field.value])));
  const [focused, setFocused] = useState(false);
  const typed = useRef(false);
  const signature = fields.map((field) => `${field.name}\u001f${field.value}`).join("\u001e");

  useEffect(() => {
    if (focused || typed.current) return;
    const next: Record<string, string> = {};
    for (const part of signature.split("\u001e")) {
      const index = part.indexOf("\u001f");
      next[part.slice(0, index)] = part.slice(index + 1);
    }
    setValues(next);
  }, [focused, signature]);

  useEffect(() => {
    if (!typed.current) return;
    const immediate = fields.every((field) => field.kind !== "text" || values[field.name] === field.value);
    const handle = window.setTimeout(() => {
      typed.current = false;
      const kinds = Object.fromEntries(fields.map((field) => [field.name, field.kind]));
      publish(router, pathname, values, kinds, true);
    }, immediate ? 0 : 250);
    return () => window.clearTimeout(handle);
  }, [fields, pathname, router, values]);

  return (
    <form className={className} role="search" onSubmit={(event) => event.preventDefault()}>
      {fields.map((field) => (
        <label key={field.name} className={field.labelClassName}>
          {field.srOnly ? <span className="sr-only">{field.label}</span> : field.label}
          {field.kind === "select" ? (
            <select
              name={field.name}
              className={field.inputClassName}
              value={values[field.name] ?? ""}
              onChange={(event) => {
                typed.current = true;
                setValues((current) => ({ ...current, [field.name]: event.target.value }));
              }}
            >
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : (
            <input
              name={field.name}
              type={field.kind === "date" ? "date" : "text"}
              className={field.inputClassName}
              placeholder={field.placeholder}
              value={values[field.name] ?? ""}
              autoComplete="off"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(event) => {
                typed.current = true;
                setValues((current) => ({ ...current, [field.name]: event.target.value }));
              }}
            />
          )}
        </label>
      ))}
    </form>
  );
}
