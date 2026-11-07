import type { ResearchActor } from "@/modules/shared/application/actor";
import type {
  AssociateInvestigationInput,
  EngagementAssetInput,
  EngagementAuthorizationInput,
  EngagementInput,
  EngagementStatusInput,
} from "../domain/engagement";

export type EngagementRow = {
  id: string;
  projectId: string;
  name: string;
  objective: string | null;
  engagementType: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  project: { name: string };
  _count: { assets: number; investigations: number };
};
export type EngagementDetail = EngagementRow & {
  assets: Array<{
    id: string;
    targetId: string;
    target: { name: string; assetIdentifier: string };
    authorizations: Array<{
      id: string;
      source: string;
      scope: { id: string; version: number; status: string; effectiveUntil: Date | null };
    }>;
  }>;
  investigations: Array<{ id: string; title: string; phase: string }>;
};
export interface EngagementStore {
  list(workspaceId: string): Promise<EngagementRow[]>;
  find(workspaceId: string, id: string): Promise<EngagementDetail | null>;
  create(actor: ResearchActor, input: EngagementInput): Promise<{ id: string }>;
  addAsset(actor: ResearchActor, input: EngagementAssetInput): Promise<{ id: string }>;
  recordAuthorization(
    actor: ResearchActor,
    input: EngagementAuthorizationInput,
  ): Promise<{ id: string }>;
  associate(actor: ResearchActor, input: AssociateInvestigationInput): Promise<{ id: string }>;
  changeStatus(actor: ResearchActor, input: EngagementStatusInput): Promise<{ id: string }>;
}
