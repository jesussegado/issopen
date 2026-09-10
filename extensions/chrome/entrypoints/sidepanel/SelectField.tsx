import {
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import "./select-field.css";

type Option = { value: string; label: string };
const normalized = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

// Lists stay inside the panel: native select popups can appear outside
// Chrome's window on Linux. Search text never replaces the confirmed ID.
export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  required = false,
  searchable = false,
  missingLabel = "Selección guardada no disponible",
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  missingLabel?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(value);
  const typeahead = useRef({ text: "", time: 0 });
  const expanded = open && !disabled;
  const selected = options.find((option) => option.value === value);
  const selectedLabel = selected?.label ?? missingLabel;
  const filtered =
    searchable && query !== null && expanded
      ? options.filter((option) =>
          normalized(option.label).includes(normalized(query.trim())),
        )
      : options;
  const activeIndex = Math.max(
    0,
    filtered.findIndex((option) => option.value === active),
  );

  function close() {
    setOpen(false);
    setQuery(null);
  }
  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
        setQuery(null);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [expanded]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: confirmed ID or lock changes must cancel a transient search.
  useEffect(() => {
    // A project change or draft replacement invalidates the old Epic search.
    setOpen(false);
    setQuery(null);
  }, [value, disabled]);
  useEffect(() => {
    if (expanded && filtered.length)
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({
        block: "nearest",
      });
  }, [expanded, activeIndex, filtered.length, id]);
  function show() {
    setActive(selected?.value ?? options[0]?.value ?? "");
    typeahead.current = { text: "", time: 0 };
    setQuery(null);
    setOpen(true);
  }
  function choose(option: Option | undefined) {
    if (!option || disabled) return;
    // Reselecting a project must not clear its Epic.
    if (option.value !== value) onChange(option.value);
    close();
    trigger.current?.focus();
  }
  function onKeyDown(
    event: KeyboardEvent<HTMLButtonElement | HTMLInputElement>,
  ) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      if (expanded) event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      close();
    } else if (event.key === "Enter" || (!searchable && event.key === " ")) {
      event.preventDefault();
      if (expanded) choose(filtered[activeIndex]);
      else show();
    } else if (
      ["ArrowDown", "ArrowUp"].includes(event.key) ||
      (!searchable && ["Home", "End"].includes(event.key))
    ) {
      event.preventDefault();
      if (!expanded) show();
      if (expanded || event.key === "Home" || event.key === "End") {
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? filtered.length - 1
              : activeIndex + (event.key === "ArrowDown" ? 1 : -1);
        setActive(
          filtered[Math.max(0, Math.min(filtered.length - 1, next))]?.value ??
            "",
        );
      }
    } else if (
      !searchable &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const now = Date.now();
      const prefix =
        (now - typeahead.current.time < 700 ? typeahead.current.text : "") +
        event.key.toLocaleLowerCase();
      if (!expanded) show();
      typeahead.current = { text: prefix, time: now };
      const match = options.find((option) =>
        option.label.toLocaleLowerCase().startsWith(prefix),
      );
      if (match) setActive(match.value);
    }
  }
  const controlProps = {
    id,
    role: "combobox" as const,
    "aria-label": label,
    "aria-expanded": expanded,
    "aria-controls": `${id}-options`,
    "aria-haspopup": "listbox" as const,
    "aria-required": required,
    "aria-activedescendant":
      expanded && filtered.length ? `${id}-option-${activeIndex}` : undefined,
    "data-selected-value": value,
    disabled,
    onKeyDown,
    onBlur: (event: FocusEvent) => {
      if (!root.current?.contains(event.relatedTarget)) close();
    },
  };
  return (
    <div ref={root} className="field-select">
      <label htmlFor={id}>{label}</label>
      {searchable ? (
        <div className="field-select-input-wrap">
          <input
            {...controlProps}
            ref={(element) => {
              trigger.current = element;
            }}
            className="field-select-input"
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            value={expanded && query !== null ? query : selectedLabel}
            placeholder={`Buscar ${label.toLocaleLowerCase()}…`}
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => {
              if (!expanded) {
                show();
                event.currentTarget.select();
              }
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive("");
              setOpen(true);
            }}
          />
          <button
            type="button"
            className="field-select-toggle"
            aria-label={`${expanded ? "Ocultar" : "Mostrar"} opciones de ${label}`}
            aria-controls={`${id}-options`}
            aria-expanded={expanded}
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (expanded) close();
              else show();
              trigger.current?.focus();
            }}
          >
            <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
          </button>
        </div>
      ) : (
        <button
          {...controlProps}
          ref={(element) => {
            trigger.current = element;
          }}
          type="button"
          value={value}
          className="field-select-trigger"
          onClick={() => (expanded ? close() : show())}
        >
          <span>{selectedLabel}</span>
          <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
        </button>
      )}
      <div
        id={`${id}-options`}
        role="listbox"
        aria-label={label}
        className="field-select-options"
        hidden={!expanded || !filtered.length}
      >
        {filtered.map((option, index) => (
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
      {expanded && !filtered.length && (
        <p className="field-select-empty" role="status">
          Sin resultados. Prueba con otro nombre.
        </p>
      )}
    </div>
  );
}
