"use client";

import { UserButton } from "@clerk/nextjs";

export function AccountMenu() {
  return (
    <UserButton appearance={{ elements: { avatarBox: "size-7" } }} aria-label="Account settings" />
  );
}
