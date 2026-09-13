import { useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import type { AccountResponse } from "../../lib/account";
import "./style.css";
import { Account } from "./Account";
import { InformationNotice } from "./Information";
import { Workspace } from "./Workspace";

function App() {
  const [account, setAccount] = useState<AccountResponse | null>(null);
  return (
    <main>
      <header className="panel-header">
        <div className="panel-brand">
          <img src="/icons/icon-48.png" width="44" height="44" alt="" />
          <div className="panel-brand-copy">
            <strong>Issopen</strong>
            <p>Imágenes y tickets, sin complicaciones</p>
          </div>
        </div>
        <Account onChange={setAccount} />
      </header>
      <p className="badge">
        Base de desarrollo · {browser.runtime.getManifest().version}
      </p>
      <InformationNotice
        onDismiss={() =>
          document.querySelector<HTMLButtonElement>(".account-trigger")?.focus()
        }
      />
      <Workspace account={account} />
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing extension root");
createRoot(root).render(<App />);
