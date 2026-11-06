// Checks effective privileges for the connected role and the audit table in its
// active schema. It cannot validate other databases, OS identities or backups.
export async function checkAuditRole(client) {
  const {rows} = await client.query(`SELECT current_user AS role, current_schema() AS schema,
    r.rolsuper OR r.rolcreaterole AS privileged_role,
    pg_has_role(current_user, c.relowner, 'MEMBER') AS can_assume_table_owner,
    pg_has_role(current_user, n.nspowner, 'MEMBER') AS can_assume_schema_owner,
    has_schema_privilege(current_user, n.oid, 'CREATE') AS can_create_in_schema,
    has_table_privilege(current_user, c.oid, 'SELECT') AS can_read,
    has_table_privilege(current_user, c.oid, 'INSERT') AS can_append,
    has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
    has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete,
    has_table_privilege(current_user, c.oid, 'TRUNCATE') AS can_truncate,
    has_table_privilege(current_user, c.oid, 'TRIGGER') AS can_create_trigger
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_roles r ON r.rolname=current_user
    WHERE c.oid=to_regclass('audit_events') AND c.relkind IN ('r','p')`);
  if (rows.length !== 1) throw new Error('audit_events table not found in the active search path');
  const checks=rows[0];
  const safe=!checks.privileged_role && !checks.can_assume_table_owner && !checks.can_assume_schema_owner && !checks.can_create_in_schema && checks.can_read && checks.can_append && !checks.can_update && !checks.can_delete && !checks.can_truncate && !checks.can_create_trigger;
  return {safe, ...checks};
}

// Inventory only: executable definer routines and reachable roles require an
// independent review of their owners, definitions, settings and dependencies.
export async function inspectAuditEscalation(client) {
  const identity=await client.query('SELECT current_database() AS database, current_user AS role, session_user AS session_role');
  const roles=await client.query(`SELECT r.rolname AS role,r.rolsuper AS superuser,r.rolcreaterole AS create_role,
    r.rolcreatedb AS create_database,r.rolreplication AS replication,r.rolbypassrls AS bypass_rls
    FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER') ORDER BY r.rolname`);
  const routines=await client.query(`SELECT n.nspname AS schema,p.proname AS routine,
    pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_userbyid(p.proowner) AS owner,
    p.proconfig AS settings
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema')
      AND has_schema_privilege(current_user,n.oid,'USAGE') AND has_function_privilege(current_user,p.oid,'EXECUTE')
    ORDER BY n.nspname,p.proname,p.oid`);
  return {identity:identity.rows[0],reachableRoles:roles.rows,executableSecurityDefiners:routines.rows,requiresManualReview:true};
}
