-- Run only as the independent migration/table owner, after creating a dedicated
-- non-superuser, non-owner runtime role. psql variables required: schema_name and
-- app_role. Never run against production without explicit operator authorization.
-- This script cannot protect against owner/superuser privileges or inherited roles.
BEGIN;
GRANT USAGE ON SCHEMA :"schema_name" TO :"app_role";
GRANT SELECT ON :"schema_name".users TO :"app_role";
GRANT SELECT, INSERT, DELETE ON :"schema_name".sessions TO :"app_role";
GRANT SELECT, INSERT, UPDATE ON :"schema_name".documents TO :"app_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON :"schema_name".document_permissions TO :"app_role";
GRANT SELECT, INSERT, UPDATE ON :"schema_name".login_throttles TO :"app_role";
REVOKE ALL ON :"schema_name".audit_events FROM :"app_role";
GRANT SELECT, INSERT ON :"schema_name".audit_events TO :"app_role";
GRANT USAGE ON SEQUENCE :"schema_name".audit_events_seq_seq TO :"app_role";
COMMIT;
