-- Enable Row-Level Security (RLS) on multi-tenant business tables

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'applicants',
        'candidate_accounts',
        'applicant_otps',
        'employees',
        'attendances',
        'sites',
        'job_roles',
        'role_categories',
        'form_definitions',
        'company_sequences',
        'month_locks',
        'audit_logs',
        'contracts',
        'invoices',
        'purchases',
        'ledger_entries'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Drop existing policy if any
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
        
        -- Enforce tenant isolation via app.current_company_id session variable
        -- Allows access if company_id matches current session context or if app.is_super_admin is 'true'
        -- Or if app.bypass_rls is 'true' (for migrations/seeds/internal background tasks)
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON %I FOR ALL USING (
                company_id = NULLIF(current_setting(''app.current_company_id'', true), '''')
                OR current_setting(''app.is_super_admin'', true) = ''true''
                OR current_setting(''app.bypass_rls'', true) = ''true''
                OR current_user = ''postgres''
            ) WITH CHECK (
                company_id = NULLIF(current_setting(''app.current_company_id'', true), '''')
                OR current_setting(''app.is_super_admin'', true) = ''true''
                OR current_setting(''app.bypass_rls'', true) = ''true''
                OR current_user = ''postgres''
            );', tbl
        );
    END LOOP;
END $$;
