import { AppLink } from "./ui.js";

export function Brand() {
  return (
    <AppLink className="wordmark" href="/" aria-label="Issopen home">
      <img
        className="brand-icon"
        src="/assets/branding/issopen-icon-v1.png"
        width="36"
        height="36"
        alt=""
      />
      <span>Issopen</span>
    </AppLink>
  );
}
