-- ADR-008 follow-up: seed read-only system report templates.
-- Workspace templates are created by owners and administrators in the app.
INSERT INTO "ReportTemplate" (
    "id",
    "workspaceId",
    "name",
    "version",
    "scope",
    "sectionSchema",
    "isActive",
    "createdBy",
    "createdAt",
    "updatedAt"
)
VALUES
    (
        '00000000-0000-4000-8000-000000000101',
        NULL,
        'Standard assessment',
        1,
        'SYSTEM',
        '[{"id":"summary","title":"Summary","required":true},{"id":"findings","title":"Findings","required":true},{"id":"evidence","title":"Evidence references","required":true},{"id":"assumptions","title":"Assumptions and limitations","required":true},{"id":"missing-information","title":"Missing information","required":true},{"id":"methodology","title":"Methodology","required":false},{"id":"recommendations","title":"Recommendations","required":false}]'::jsonb,
        true,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-4000-8000-000000000102',
        NULL,
        'Finding brief',
        1,
        'SYSTEM',
        '[{"id":"summary","title":"Summary","required":true},{"id":"findings","title":"Findings","required":true},{"id":"evidence","title":"Evidence references","required":true},{"id":"assumptions","title":"Assumptions and limitations","required":true},{"id":"missing-information","title":"Missing information","required":true}]'::jsonb,
        true,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        '00000000-0000-4000-8000-000000000103',
        NULL,
        'Reproduction record',
        1,
        'SYSTEM',
        '[{"id":"summary","title":"Summary","required":true},{"id":"findings","title":"Findings","required":true},{"id":"evidence","title":"Evidence references","required":true},{"id":"assumptions","title":"Assumptions and limitations","required":true},{"id":"missing-information","title":"Missing information","required":true},{"id":"methodology","title":"Methodology","required":false},{"id":"recommendations","title":"Recommendations","required":false}]'::jsonb,
        true,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT ("id") DO NOTHING;
