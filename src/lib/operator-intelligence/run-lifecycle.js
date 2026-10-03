const RUN_FAILURE_STATUSES = new Set(['failed', 'partial_error', 'cancelled']);
const RUN_IN_PROGRESS_STATUSES = new Set(['pending', 'running']);
const RUN_SUCCESS_STATUSES = new Set(['completed', 'partial']);

export function isRunFailureStatus(status) {
    return RUN_FAILURE_STATUSES.has(status);
}

export function isRunInProgressStatus(status) {
    return RUN_IN_PROGRESS_STATUSES.has(status);
}

export function isRunSuccessStatus(status) {
    return RUN_SUCCESS_STATUSES.has(status);
}

export function createRunStatusCounts() {
    return {
        pending: 0,
        running: 0,
        completed: 0,
        partial: 0,
        partial_error: 0,
        failed: 0,
        cancelled: 0,
    };
}

export function getRunWarningMessage(run = {}) {
    if (!Array.isArray(run?.parse_warnings)) return null;
    return run.parse_warnings.find((warning) => typeof warning === 'string' && warning.trim()) || null;
}

export function normalizeRunParseStatus(run = {}) {
    const parseStatus = run?.parse_status ?? null;
    if (!parseStatus) return null;
    if (!isRunInProgressStatus(run?.status)) return parseStatus;

    const hasTerminalArtifacts = Boolean(
        run?.error_class
        || run?.latency_ms !== null && run?.latency_ms !== undefined
        || (typeof run?.response_text === 'string' && run.response_text.trim())
        || (typeof run?.raw_response_full === 'string' && run.raw_response_full.trim())
        || run?.raw_analysis?.error
    );

    return hasTerminalArtifacts ? parseStatus : null;
}

export function getRunFailureMessage(run = {}) {
    if (!isRunFailureStatus(run?.status)) return null;
    return run?.raw_analysis?.error || getRunWarningMessage(run) || 'Execution run impossible';
}

export function getRunDiagnostic(run = {}) {
    const parseStatus = normalizeRunParseStatus(run);
    const failureMessage = getRunFailureMessage(run);
    if (failureMessage) {
        return {
            kind: 'execution_failure',
            tone: 'critical',
            title: "Diagnostic d'execution",
            message: failureMessage,
        };
    }

    const warningMessage = getRunWarningMessage(run);
    if (parseStatus === 'parsed_failed') {
        return {
            kind: 'parse_failure',
            tone: 'critical',
            title: 'Diagnostic de parse',
            message: warningMessage || "Le pipeline d'extraction n'a pas pu structurer cette reponse.",
        };
    }

    if (warningMessage) {
        return {
            kind: parseStatus === 'parsed_success' ? 'parse_note' : 'parse_warning',
            tone: 'attention',
            title: parseStatus === 'parsed_success' ? "Note d'extraction" : "Avertissement d'extraction",
            message: warningMessage,
        };
    }

    if (parseStatus === 'parsed_partial') {
        return {
            kind: 'parse_warning',
            tone: 'attention',
            title: "Avertissement d'extraction",
            message: "Le pipeline d'extraction a produit un resultat partiel.",
        };
    }

    return null;
}

export function isRunProblematic(run = {}) {
    const parseStatus = normalizeRunParseStatus(run);
    return isRunFailureStatus(run?.status) || parseStatus === 'parsed_failed' || parseStatus === 'parsed_partial';
}

export function needsRunOperatorReview(run = {}) {
    const parseStatus = normalizeRunParseStatus(run);
    if (isRunFailureStatus(run?.status)) return true;
    if (parseStatus === 'parsed_failed' || parseStatus === 'parsed_partial') return true;
    if (isRunSuccessStatus(run?.status) && run?.parse_confidence !== null && run?.parse_confidence !== undefined && Number(run.parse_confidence) < 0.5) return true;
    return false;
}