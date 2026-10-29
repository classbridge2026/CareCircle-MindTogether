import Link from "next/link";
import { Fragment } from "react";

function rich(line: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const click = /^\*\*([^*]+)\*\*$/.exec(part);
    if (!click) return <Fragment key={index}>{part}</Fragment>;
    return (
      <strong key={index} className="guide-click">
        {click[1]}
      </strong>
    );
  });
}

export function GuideCopy({
  text,
  href,
  label,
  onOpen,
}: {
  text: string;
  href?: string;
  label?: string;
  onOpen: (href: string) => void;
}) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !label || line !== `Click to go to ${label}.`);
  const steps = lines.filter((line) => /^\d+\.\s/.test(line));
  const prose = lines.filter((line) => !/^\d+\.\s/.test(line));
  const go =
    href && label ? (
      <Link
        href={href}
        className="guide-go"
        prefetch={false}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onOpen(href);
        }}
      >
        Click {label}
      </Link>
    ) : null;

  return (
    <>
      {prose.map((line) => (
        <p key={line}>{rich(line)}</p>
      ))}
      {steps.length > 0 ? go : null}
      {steps.length > 0 ? (
        <ol className="guide-steps">
          {steps.map((line) => (
            <li key={line}>{rich(line.replace(/^\d+\.\s+/, ""))}</li>
          ))}
        </ol>
      ) : (
        go
      )}
    </>
  );
}
