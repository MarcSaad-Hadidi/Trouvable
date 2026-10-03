import 'server-only';
import { db as sb } from '@/lib/db/core';

export function uniqueNonEmptyStrings(values) {
    return [...new Set((values || []).filter((value) => typeof value === 'string' && value.trim().length > 0))];
}

export async function validateClientAuditReferences(rows, context) {
    const payloads = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (payloads.length === 0) return;

    const clientIds = uniqueNonEmptyStrings(payloads.map((row) => row.client_id));
    const auditIds = uniqueNonEmptyStrings(payloads.map((row) => row.audit_id));

    if (clientIds.length === 0) {
        throw new Error(`[DB] ${context}: missing client_id on payload(s)`);
    }

    const { data: clientRows, error: clientError } = await sb()
        .from('client_geo_profiles')
        .select('id')
        .in('id', clientIds);
    if (clientError) {
        throw new Error(`[DB] ${context}: failed to validate client_id references: ${clientError.message}`);
    }

    const existingClientIds = new Set((clientRows || []).map((row) => row.id));
    const missingClientIds = clientIds.filter((id) => !existingClientIds.has(id));
    if (missingClientIds.length > 0) {
        throw new Error(`[DB] ${context}: invalid client_id reference(s): ${missingClientIds.join(', ')}`);
    }

    if (auditIds.length === 0) return;

    const { data: auditRows, error: auditError } = await sb()
        .from('client_site_audits')
        .select('id, client_id')
        .in('id', auditIds);
    if (auditError) {
        throw new Error(`[DB] ${context}: failed to validate audit_id references: ${auditError.message}`);
    }

    const auditsById = new Map((auditRows || []).map((row) => [row.id, row]));
    const missingAuditIds = auditIds.filter((id) => !auditsById.has(id));
    if (missingAuditIds.length > 0) {
        throw new Error(`[DB] ${context}: invalid audit_id reference(s): ${missingAuditIds.join(', ')}`);
    }

    const mismatches = payloads
        .filter((row) => row.audit_id)
        .map((row, index) => {
            const audit = auditsById.get(row.audit_id);
            if (!audit || audit.client_id === row.client_id) return null;
            return `payload[${index}] audit_id=${row.audit_id} belongs to client_id=${audit.client_id}, received client_id=${row.client_id}`;
        })
        .filter(Boolean);

    if (mismatches.length > 0) {
        throw new Error(`[DB] ${context}: audit/client mismatch detected (${mismatches.join(' | ')})`);
    }
}
