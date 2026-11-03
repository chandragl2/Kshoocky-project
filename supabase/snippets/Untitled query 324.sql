
SELECT
    role_name,
    table_name,
    has_table_privilege(
        role_name,
        'public.' || table_name,
        'MAINTAIN'
    ) AS can_maintain,
    has_table_privilege(
        role_name,
        'public.' || table_name,
        'TRUNCATE'
    ) AS can_truncate,
    has_table_privilege(
        role_name,
        'public.' || table_name,
        'TRIGGER'
    ) AS can_trigger
FROM (
    VALUES ('anon'), ('authenticated'), ('service_role')
) AS roles(role_name)
CROSS JOIN (
    VALUES ('carts'), ('cart_items')
) AS tables(table_name)
ORDER BY table_name, role_name;

SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('carts', 'cart_items')
ORDER BY c.relname;
