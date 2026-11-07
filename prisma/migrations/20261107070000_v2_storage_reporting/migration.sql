-- Expand the internal registry, retaining the existing queue and limits.
ALTER TABLE "BackgroundJob" DROP CONSTRAINT "BackgroundJob_limits_check";
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_limits_check" CHECK ("attempts" >= 0 AND "maxAttempts" BETWEEN 1 AND 5 AND "progress" BETWEEN 0 AND 100 AND "kind" IN ('AI_TASK','KNOWLEDGE_INDEX','TOOL_IMPORT','EVIDENCE_CLEANUP','EVIDENCE_PROMOTION'));

-- Existing templates and report content are preserved. These profiles use the same renderer.
INSERT INTO "ReportTemplate" (id,"workspaceId",name,version,scope,"sectionSchema","isActive","createdBy","updatedAt") VALUES
('00000000-0000-4000-8000-000000000111',NULL,'Bug bounty report',1,'SYSTEM','[{"id":"summary","title":"Bug bounty summary","required":true},{"id":"findings","title":"Vulnerability and demonstrated impact","required":true},{"id":"evidence","title":"Supporting evidence","required":true},{"id":"assumptions","title":"Preconditions and assumptions","required":true},{"id":"missing-information","title":"Missing reproduction information","required":true},{"id":"methodology","title":"Supplied reproduction and research method","required":false},{"id":"recommendations","title":"Recommended remediation","required":false}]',true,NULL,now()),
('00000000-0000-4000-8000-000000000112',NULL,'Formal audit report',1,'SYSTEM','[{"id":"summary","title":"Assessment summary","required":true},{"id":"methodology","title":"Assessment approach","required":false},{"id":"findings","title":"Verified findings","required":true},{"id":"evidence","title":"Evidence register","required":true},{"id":"assumptions","title":"Scope assumptions and limitations","required":true},{"id":"missing-information","title":"Outstanding information","required":true},{"id":"recommendations","title":"Remediation recommendations","required":false}]',true,NULL,now()) ON CONFLICT (id) DO NOTHING;

-- Historical version links are untouched; new reviewed replacements must match their parent.
CREATE FUNCTION sentinel_v2_evidence_replacement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."supersedesId" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW."supersedesId" IS DISTINCT FROM OLD."supersedesId") THEN
    IF NOT EXISTS (SELECT 1 FROM "Evidence" p WHERE p.id = NEW."supersedesId" AND p."workspaceId" = NEW."workspaceId" AND p."investigationId" = NEW."investigationId" AND p.version + 1 = NEW.version) THEN RAISE EXCEPTION 'Evidence replacement must match parent tenant, investigation and version'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Evidence_replacement_parent" BEFORE INSERT OR UPDATE ON "Evidence" FOR EACH ROW EXECUTE FUNCTION sentinel_v2_evidence_replacement();
