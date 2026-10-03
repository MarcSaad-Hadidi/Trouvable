import 'server-only';

import { callAiJson, callAiText } from '@/lib/ai/index';
import { insertTaskRun, updateTaskRun } from './log.js';

/**
 * Task registry.
 * Each task is a plain object with:
 *   taskId, mode ('json' | 'text'), provider, fallbackProvider,
 *   temperature, maxTokens, purpose,
 *   buildMessages(input), outputSchema (Zod, optional),
 *   normalize(raw, input) (optional — graceful degradation)
 */
const TASKS = {};

/**
 * Registers a named AI task. Call at module load time.
 */
export function registerTask(definition) {
    if (!definition?.taskId) throw new Error('[AI/Tasks] taskId is required');
    if (TASKS[definition.taskId]) throw new Error(`[AI/Tasks] Duplicate taskId: ${definition.taskId}`);
    TASKS[definition.taskId] = definition;
}

/**
 * Returns the task definition for a given taskId, or null.
 */
export function getTask(taskId) {
    return TASKS[taskId] || null;
}

/**
 * Executes a registered AI task with full traceability.
 *
 * @param {string} taskId — registered task identifier
 * @param {object} input — task-specific input (passed to buildMessages)
 * @param {object} [options]
 * @param {string} [options.clientId] — for traceability
 * @param {string} [options.triggerSource='system'] — cron, manual, pipeline, system
 * @param {string} [options.parentRunId] — parent AI task run for chaining
 * @param {boolean} [options.skipLog=false] — skip DB logging (for tests or dry runs)
 * @returns {{ data, meta, runId, validation }}
 */
export async function executeTask(taskId, input, options = {}) {
    const task = TASKS[taskId];
    if (!task) throw new Error(`[AI/Tasks] Unknown task: ${taskId}`);

    const {
        clientId = null,
        triggerSource = 'system',
        parentRunId = null,
        skipLog = false,
    } = options;

    const startMs = Date.now();
    let logRow = null;

    // Create log entry
    if (!skipLog) {
        try {
            logRow = await insertTaskRun({
                client_id: clientId,
                task_id: taskId,
                provider: task.provider || 'mistral',
                model: null,
                status: 'running',
                input_summary: sanitizeInputSummary(input),
                trigger_source: triggerSource,
                parent_run_id: parentRunId,
            });
        } catch (logErr) {
            console.warn(`[AI/Tasks] Failed to create log entry for ${taskId}:`, logErr.message);
        }
    }

    try {
        const messages = task.buildMessages(input);
        const callParams = {
            messages,
            purpose: task.purpose || 'query',
            temperature: task.temperature ?? 0.15,
            maxTokens: task.maxTokens || 2048,
            providerOverride: task.provider || 'mistral',
            fallbackProvider: task.fallbackProvider ?? null,
            modelOverride: task.modelOverride || null,
        };

        let rawResult;
        if (task.mode === 'json') {
            rawResult = await callAiJson(callParams);
        } else {
            rawResult = await callAiText(callParams);
        }

        // Validate with Zod if schema exists
        const validation = validateOutput(task, rawResult);

        // Normalize if the task provides a normalizer
        const data = task.normalize
            ? task.normalize(validation.data, input)
            : validation.data;

        if (task.assertResult) {
            task.assertResult({
                data,
                input,
                validation,
                rawResult,
            });
        }

        const latencyMs = Date.now() - startMs;
        const meta = {
            provider: rawResult.provider,
            model: rawResult.model,
            usage: rawResult.usage || {},
            latencyMs,
        };

        // Update log
        if (logRow && !skipLog) {
            try {
                await updateTaskRun(logRow.id, {
                    status: 'completed',
                    model: meta.model,
                    provider: meta.provider,
                    latency_ms: latencyMs,
                    usage_tokens: meta.usage,
                    output_summary: summarizeOutput(data),
                    validation_status: validation.status,
                    validation_warnings: validation.warnings,
                });
            } catch (updateErr) {
                console.warn(`[AI/Tasks] Failed to update log for ${taskId}:`, updateErr.message);
            }
        }

        return { data, meta, runId: logRow?.id || null, validation };
    } catch (err) {
        const latencyMs = Date.now() - startMs;

        if (logRow && !skipLog) {
            try {
                await updateTaskRun(logRow.id, {
                    status: 'failed',
                    latency_ms: latencyMs,
                    error_message: String(err.message || err).slice(0, 2000),
                    error_class: classifyError(err),
                    validation_status: 'invalid',
                });
            } catch (updateErr) {
                console.warn(`[AI/Tasks] Failed to log failure for ${taskId}:`, updateErr.message);
            }
        }

        throw err;
    }
}

// ── Helpers ──────────────────────────────────────────────────

function validateOutput(task, rawResult) {
    const raw = task.mode === 'json' ? rawResult.data : rawResult.text;

    if (!task.outputSchema) {
        return { data: raw, status: 'valid', warnings: [] };
    }

    const result = task.outputSchema.safeParse(raw);
    if (result.success) {
        return { data: result.data, status: 'valid', warnings: [] };
    }

    const warnings = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
    );

    return {
        data: raw,
        status: 'partial',
        warnings,
    };
}

function sanitizeInputSummary(input) {
    if (!input || typeof input !== 'object') return {};
    try {
        const summary = {};
        for (const [key, value] of Object.entries(input)) {
            if (typeof value === 'string') {
                summary[key] = value.length > 200 ? `${value.slice(0, 200)}…` : value;
            } else if (Array.isArray(value)) {
                summary[key] = `[${value.length} items]`;
            } else if (typeof value === 'object' && value !== null) {
                summary[key] = `{${Object.keys(value).join(', ')}}`;
            } else {
                summary[key] = value;
            }
        }
        return summary;
    } catch {
        return {};
    }
}

function summarizeOutput(data) {
    if (!data) return {};
    if (Array.isArray(data)) return { count: data.length, type: 'array' };
    if (typeof data === 'object') {
        const keys = Object.keys(data);
        return { keys: keys.slice(0, 10), type: 'object' };
    }
    if (typeof data === 'string') return { length: data.length, type: 'text' };
    return { type: typeof data };
}

function classifyError(err) {
    if (err?.name === 'CorrectionPromptValidationError') return 'validation_error';
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('timeout')) return 'timeout';
    if (msg.includes('rate') || msg.includes('429')) return 'rate_limit';
    if (msg.includes('parse') || msg.includes('json')) return 'parse_error';
    if (msg.includes('provider') || msg.includes('api key')) return 'provider_error';
    return 'runtime_error';
}
