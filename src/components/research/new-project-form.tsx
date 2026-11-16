"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BountyImportForm } from "./bounty-import-form";
import { ProjectForm } from "./project-form";

export function NewProjectForm({ initialJobId }: { initialJobId?: string }) {
  const [method, setMethod] = useState("bounty");

  return (
    <Tabs value={method} onValueChange={setMethod}>
      <TabsList aria-label="Create project method">
        <TabsTrigger value="bounty">Import bounty with AI</TabsTrigger>
        <TabsTrigger value="manual">Create manually</TabsTrigger>
      </TabsList>
      <TabsContent value="bounty" forceMount hidden={method !== "bounty"}>
        <BountyImportForm initialJobId={initialJobId} />
      </TabsContent>
      <TabsContent value="manual" forceMount hidden={method !== "manual"}>
        <ProjectForm mode="create" />
      </TabsContent>
    </Tabs>
  );
}
