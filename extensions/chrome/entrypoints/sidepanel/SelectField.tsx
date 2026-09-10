import { useEffect, useId, useRef, useState } from "react";
import "./select-field.css";

type Option = { value: string; label: string };

// Render the list in the panel, not in an OS popup: native select popups can
// be positioned outside Chrome's window when used in the Linux side panel.
export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  required = false,
  missingLabel = "Selección guardada no disponible",
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  missingLabel?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const typeahead = useRef({ text: "", time: 0 });
  const expanded = open && !disabled;
  const selected = options.find((option) => option.value === value);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === active),
  );
  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [expanded]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (expanded)
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({
        block: "nearest",
      });
  }, [expanded, activeIndex, id]);
  function show() {
    setActive(selected?.value ?? options[0]?.value ?? "");
    typeahead.current = { text: "", time: 0 };
    setOpen(true);
  }
  function choose(option: Option | undefined) {
    if (!option || disabled) return;
    // Reselecting a project must not clear its Epic.
    if (option.value !== value) onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div ref={root} className="field-select">
      <label htmlFor={id}>{label}</label>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={`${id}-options`}
        aria-haspopup="listbox"
        aria-required={required}
        aria-activedescendant={
          expanded && options.length ? `${id}-option-${activeIndex}` : undefined
        }
        value={value}
        disabled={disabled}
        className="field-select-trigger"
        onBlur={(event) => {
          if (!root.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onClick={() => (expanded ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (expanded) event.preventDefault();
            setOpen(false);
          } else if (event.key === "Tab") {
            setOpen(false);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (expanded) choose(options[activeIndex]);
            else show();
          } else if (
            ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
          ) {
            event.preventDefault();
            if (!expanded) show();
            if (expanded || event.key === "Home" || event.key === "End") {
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? options.length - 1
                    : activeIndex + (event.key === "ArrowDown" ? 1 : -1);
              setActive(
                options[Math.max(0, Math.min(options.length - 1, next))]
                  ?.value ?? "",
              );
            }
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            const now = Date.now();
            const prefix =
              (now - typeahead.current.time < 700
                ? typeahead.current.text
                : "") + event.key.toLocaleLowerCase();
            if (!expanded) show();
            typeahead.current = { text: prefix, time: now };
            const match = options.find((option) =>
              option.label.toLocaleLowerCase().startsWith(prefix),
            );
            if (match) setActive(match.value);
          }
        }}
      >
        <span>{selected?.label ?? missingLabel}</span>
        <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
      </button>
      <div
        id={`${id}-options`}
        role="listbox"
        aria-label={label}
        className="field-select-options"
        hidden={!expanded}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            id={`${id}-option-${index}`}
            type="button"
            role="option"
            aria-selected={option.value === value}
            tabIndex={-1}
            disabled={disabled}
            className="field-select-option"
            data-active={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
          >
            <span>{option.label}</span>
            {option.value === value && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
