import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useRef,
} from "react";
import { navigate } from "../lib/navigation.js";

export function AppLink({
  href = "/",
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey
        ) {
          event.preventDefault();
          navigate(href);
        }
      }}
    />
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "destructive";
  }
>(function Button({ variant = "primary", className = "", ...props }, ref) {
  return (
    <button
      ref={ref}
      {...props}
      className={`button button-${variant} ${className}`.trim()}
    />
  );
});

export function Field({
  label,
  htmlFor,
  helper,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  helper?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span>
        {label}
        {required ? " (required)" : ""}
      </span>
      {children}
      {helper ? <span className="field-helper">{helper}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput(props, ref) {
  return <input ref={ref} {...props} />;
});

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={5} {...props} />;
}

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select(props, ref) {
  return <select ref={ref} {...props} />;
});

export function Badge({
  children,
  mono = false,
}: {
  children: ReactNode;
  mono?: boolean;
}) {
  return <span className={`badge${mono ? " mono" : ""}`}>{children}</span>;
}

export function StatusBanner({
  children,
  error = false,
  focus = false,
}: {
  children: ReactNode;
  error?: boolean;
  focus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <div
      ref={ref}
      className={`status-banner${error ? " error" : ""}`}
      role={error ? "alert" : "status"}
      tabIndex={focus ? -1 : undefined}
    >
      {children}
    </div>
  );
}

export function OfflineBanner() {
  return (
    <StatusBanner error>
      You're offline. Changes can't be saved until you reconnect.
    </StatusBanner>
  );
}

export function Skeleton({ label = "Loading page…" }: { label?: string }) {
  return (
    <div className="skeleton-wrap">
      <p className="sr-only" role="status">
        {label}
      </p>
      <div className="skeleton skeleton-title" aria-hidden="true" />
      <div className="skeleton skeleton-line" aria-hidden="true" />
      <div className="skeleton skeleton-panel" aria-hidden="true" />
    </div>
  );
}

export function PageHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h1 ref={ref} tabIndex={-1}>
      {children}
    </h1>
  );
}

export function ErrorSummary({
  errors,
}: {
  errors: { field: string; message: string }[];
}) {
  if (errors.length === 0) return null;
  return (
    <StatusBanner error focus>
      <p>Please correct the following:</p>
      <ul>
        {errors.map((error) => (
          <li key={`${error.field}-${error.message}`}>
            <a href={`#${error.field}`}>{error.message}</a>
          </li>
        ))}
      </ul>
    </StatusBanner>
  );
}

export function EmptyState({
  heading,
  body,
  action,
}: {
  heading: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <h2>{heading}</h2>
      <p>{body}</p>
      {action}
    </section>
  );
}
