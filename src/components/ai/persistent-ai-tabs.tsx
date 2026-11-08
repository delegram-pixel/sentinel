"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";
import { changeSessionModeAction } from "@/app/(dashboard)/dashboard/investigations/session-actions";
export function PersistentAiTabs({
  conversationId,
  mode,
  children,
}: {
  conversationId?: string;
  mode: "GUIDED" | "DELEGATED";
  children: ReactNode;
}) {
  const [selected, setSelected] = useState(mode.toLowerCase());
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function change(value: string) {
    if (pending) return;
    setSelected(value);
    setError(undefined);
    if (conversationId)
      startTransition(async () => {
        try {
          const result = await changeSessionModeAction({
            conversationId,
            expectedMode: mode,
            mode: value.toUpperCase(),
          });
          if (!result.ok) {
            setError(result.message);
            setSelected(mode.toLowerCase());
          }
          router.refresh();
        } catch {
          setError(
            "We couldn't save the session mode. Refresh the page, then try switching modes again.",
          );
          setSelected(mode.toLowerCase());
        }
      });
  }
  return (
    <>
      <Tabs value={selected} onValueChange={change}>
        {children}
      </Tabs>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
