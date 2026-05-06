import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./ui/button";
import { getApiBase, getApiKey, setApiBase, setApiKey } from "../lib/api";
import { Settings as SettingsIcon, X } from "lucide-react";

interface Props {
  onSaved: () => void;
  forceOpen?: boolean;
}

export function SettingsModal({ onSaved, forceOpen = false }: Props) {
  const [open, setOpen] = useState(forceOpen);
  const [base, setBase] = useState(getApiBase());
  const [key, setKey] = useState(getApiKey());

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const save = () => {
    setApiBase(base.trim());
    setApiKey(key.trim());
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !forceOpen && setOpen(v)}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">Connect to API</Dialog.Title>
            {!forceOpen && (
              <Dialog.Close asChild>
                <button className="rounded p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            )}
          </div>
          <Dialog.Description className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Credentials are stored locally in your browser. They are sent only to the configured
            API endpoint via the <code className="text-brand-500 dark:text-brand-300">x-api-key</code>{" "}
            header.
          </Dialog.Description>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                API Base URL
              </span>
              <input
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="https://hr-api-xxxx.run.app"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                API Key
              </span>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="x-api-key value"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            {!forceOpen && (
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
            )}
            <Button size="sm" onClick={save} disabled={!base || !key}>
              Save & connect
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
