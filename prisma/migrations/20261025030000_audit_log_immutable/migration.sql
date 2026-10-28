-- Audit and record-access rows are append-only.
-- The application database role cannot update or delete them, including through a future query bug.
-- Applying this migration does not rewrite existing rows.

CREATE OR REPLACE FUNCTION "reject_protected_audit_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'protected audit records cannot be updated or deleted'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS "AuditLog_no_mutation" ON "AuditLog";
CREATE TRIGGER "AuditLog_no_mutation"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW
  EXECUTE PROCEDURE "reject_protected_audit_mutation"();

DROP TRIGGER IF EXISTS "RecordAccessLog_no_mutation" ON "RecordAccessLog";
CREATE TRIGGER "RecordAccessLog_no_mutation"
  BEFORE UPDATE OR DELETE ON "RecordAccessLog"
  FOR EACH ROW
  EXECUTE PROCEDURE "reject_protected_audit_mutation"();
