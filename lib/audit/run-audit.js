import 'server-only';
import { runSiteAudit } from './scanner.js';
import { scoreAuditV2 } from './score.js';
import { extractForLLM } from './extract.js';
import { classifySiteForAudit } from './site-classification.js';
import { analyzeCrawlerAccess } from './crawler-access.js';
import { generateOpportunities } from './opportunities.js';
import { generateMergeSuggestions } from './merge.js';
import { runLayer2Expert } from './layer2/index.js';
import { buildLayeredAuditObject } from './layered-audit.js';
import {
  isLayeredPipelineEnabled,
  isLayer2ExpertEnabled,
  isShadowModeEnabled,
  AUDIT_VERSION_LEGACY,
  AUDIT_VERSION_LAYERED,
  LAYERED_SCHEMA_KEY,
} from './audit-config.js';
import { callAiJson } from '../ai/index.js';
import { buildAuditAnalysisPrompt } from '../ai/prompts.js';
import { normalizeAuditAnalysis } from '../ai/normalize.js';
import { getAdminSupabase } from '../supabase-admin.js';
import * as db from '../db.js';

const AUDIT_TIMEOUT_MS = 280_000;

function createAuditTimeoutError() {
  const error = new Error('audit_timeout_exceeded');
  error.name = 'AbortError';
  return error;
}

function isTimeoutError(error) {
  return (
    error?.name === 'AbortError'
    || error?.message === 'audit_timeout_exceeded'
  );
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : createAuditTimeoutError();
}

/**
 * Pipeline:
 *   1. Crawl (scanner) → raw pages + extracted_data
 *   2. Classify site type → weight profile + applicability
 *   3. Score deterministically (score.js) → seo_score, geo_score, issues, strengths
 *   4. Extract compact payload for LLM (extract.js)
 *   5. LLM analysis (optional, fallback-safe)
 *   6. Compute scores: deterministic_score, llm_score, hybrid_score
 *   7. Final persist audit status (terminal write)
 *   8. Archive/create opportunities + merge suggestions (best effort, post-terminal)
 *   9. Action log (best effort, post-finalization)
 */
export async function runFullAudit(clientId, websiteUrl) {
  const startMs = Date.now();
  const stepTimings = [];

  const controller = new AbortController();
  const { signal } = controller;

  const sharedCtx = {
    auditId: null,
    finalized: false,
    finalStatus: null,
    finalRow: null,
    finalizationPromise: null,
    done: false,
    finalizeAuditOnce: null,
  };

  let timeoutId = null;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort(createAuditTimeoutError());
      reject(createAuditTimeoutError());
    }, AUDIT_TIMEOUT_MS);
  });

  const corePromise = _runFullAuditCore(
    clientId,
    websiteUrl,
    startMs,
    stepTimings,
    signal,
    sharedCtx,
  );

  try {
    return await Promise.race([corePromise, timeoutPromise]);
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error;
    }

    console.error('[Audit] global_timeout', {
      client_id: clientId,
      audit_id: sharedCtx.auditId || null,
      timeout_ms: AUDIT_TIMEOUT_MS,
    });

    if (sharedCtx.auditId && typeof sharedCtx.finalizeAuditOnce === 'function' && !sharedCtx.finalized) {
      try {
        await sharedCtx.finalizeAuditOnce({
          scan_status: 'failed',
          error_message: 'Audit timed out after max duration (global timeout)',
        });
      } catch (finalizeError) {
        console.error('[Audit] Timeout finalization failed:', finalizeError.message);
      }
    }

    // Si l'audit a déjà été finalisé avec succès/partial_error juste avant le timeout,
    // on laisse la réponse finale cohérente venir du core.
    if (sharedCtx.finalized && sharedCtx.finalStatus && sharedCtx.finalStatus !== 'failed') {
      return await corePromise;
    }

    return {
      success: false,
      error: 'audit_timeout',
      auditId: sharedCtx.auditId || null,
      stepTimings,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function _runFullAuditCore(clientId, websiteUrl, startMs, stepTimings, signal, sharedCtx) {
  function logStep(name, stepStartMs) {
    const duration = Date.now() - stepStartMs;
    stepTimings.push({ step: name, duration_ms: duration, status: 'ok' });
  }

  function logStepError(name, stepStartMs, error) {
    const duration = Date.now() - stepStartMs;
    stepTimings.push({ step: name, duration_ms: duration, status: 'error', error: error.message });
    console.error(`[Audit] [${name}] FAILED ${duration}ms: ${error.message}`);
  }

  function stopBecauseFinalized() {
    return signal?.aborted || sharedCtx.finalStatus === 'failed';
  }

  const supabase = getAdminSupabase();
  let auditRecord = null;

  async function finalizeAuditOnce(payload) {
    if (!auditRecord?.id) return null;
    if (sharedCtx.finalized) return sharedCtx.finalRow;

    if (sharedCtx.finalizationPromise) {
      return sharedCtx.finalizationPromise;
    }

    sharedCtx.finalizationPromise = (async () => {
      const desiredStatus = payload.scan_status || null;

      // Finalisation atomique: ne finaliser que si l'audit est encore "running".
      const { data, error } = await supabase
        .from('client_site_audits')
        .update(payload)
        .eq('id', auditRecord.id)
        .eq('scan_status', 'running')
        .select('*')
        .maybeSingle();

      if (error) {
        throw new Error(`[Audit] finalizeAuditOnce ${auditRecord.id}: ${error.message}`);
      }

      if (data) {
        sharedCtx.finalized = true;
        sharedCtx.finalStatus = data.scan_status || desiredStatus;
        sharedCtx.finalRow = data;
        sharedCtx.done = true;
        return data;
      }

      // Rien mis à jour : on relit l'état courant.
      const { data: existing, error: existingError } = await supabase
        .from('client_site_audits')
        .select('*')
        .eq('id', auditRecord.id)
        .maybeSingle();

      if (existingError) {
        throw new Error(`[Audit] finalizeAuditOnce read ${auditRecord.id}: ${existingError.message}`);
      }

      if (existing && existing.scan_status && existing.scan_status !== 'running') {
        sharedCtx.finalized = true;
        sharedCtx.finalStatus = existing.scan_status;
        sharedCtx.finalRow = existing;
        sharedCtx.done = true;
        return existing;
      }

      return null;
    })();

    try {
      return await sharedCtx.finalizationPromise;
    } finally {
      if (!sharedCtx.finalized) {
        sharedCtx.finalizationPromise = null;
      }
    }
  }

  sharedCtx.finalizeAuditOnce = finalizeAuditOnce;

  try {
    const client = await db.getClientById(clientId);
    const resolvedClientId = client.id;
    const rawWebsiteUrl = websiteUrl || client.website_url;
    const normalizedWebsiteUrl = String(rawWebsiteUrl || '').trim();

    if (!normalizedWebsiteUrl) {
      return { success: false, error: 'invalid_url', auditId: null };
    }

    let resolvedWebsiteUrl;
    try {
      const parsedUrl = new URL(normalizedWebsiteUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return { success: false, error: 'invalid_url', auditId: null };
      }
      resolvedWebsiteUrl = parsedUrl.toString();
    } catch {
      return { success: false, error: 'invalid_url', auditId: null };
    }

    throwIfAborted(signal);

    const layeredEnabled = isLayeredPipelineEnabled();
    const shadowMode = isShadowModeEnabled();
    const auditVersion = layeredEnabled ? AUDIT_VERSION_LAYERED : AUDIT_VERSION_LEGACY;

    auditRecord = await db.createAuditRun({
      client_id: resolvedClientId,
      source_url: resolvedWebsiteUrl,
      scan_status: 'running',
      audit_version: auditVersion,
    });

    sharedCtx.auditId = auditRecord.id;

    if (auditRecord?.client_id && auditRecord.client_id !== resolvedClientId) {
      throw new Error(
        `[Audit] Audit/client mismatch: audit ${auditRecord.id} recorded client_id=${auditRecord.client_id} for expected client_id=${resolvedClientId}`,
      );
    }

    throwIfAborted(signal);

    // --- Step 1: Crawl ---
    let t0 = Date.now();
    const scanResults = await runSiteAudit(resolvedWebsiteUrl);
    throwIfAborted(signal);

    const successPages = (scanResults.scanned_pages || []).filter((p) => p.success).length;
    logStep('crawl', t0);

    if (successPages === 0 || (scanResults.scanned_pages || []).length === 0) {
      const errMsg = scanResults.error_message || 'Crawl produced no successful pages';
      await finalizeAuditOnce({
        scan_status: 'failed',
        error_message: errMsg,
      });

      return {
        success: false,
        error: errMsg,
        auditId: auditRecord.id,
        stepTimings,
      };
    }

    // --- Step 2: Classify ---
    t0 = Date.now();
    const siteClassification = classifySiteForAudit(scanResults);
    logStep('classify', t0);
    throwIfAborted(signal);

    // --- Step 2.5: AI crawler access analysis (best-effort) ---
    let crawlerAccessData = null;
    try {
      t0 = Date.now();
      crawlerAccessData = await analyzeCrawlerAccess(resolvedWebsiteUrl);
      logStep('crawler_access', t0);
    } catch (crawlerError) {
      logStepError('crawler_access', t0, crawlerError);
    }
    throwIfAborted(signal);

    // --- Step 2.75: Layer 2 expert enrichments (deep llms, AI discovery,
    // brand/entity, trust stack, negative signals). Diagnostic only — never
    // overrides the Trouvable product score. Off only when the layered
    // pipeline or the L2 flag is explicitly disabled. ---
    let layer2Expert = null;
    if (layeredEnabled && isLayer2ExpertEnabled()) {
      t0 = Date.now();
      try {
        layer2Expert = await runLayer2Expert({
          siteUrl: resolvedWebsiteUrl,
          scanResults,
          crawlerAccessData,
          layer1PageChecks: scanResults?.extracted_data?.layered_v1_layer1?.page_level_checks || [],
        });
        logStep('layer2_expert', t0);
      } catch (layer2Error) {
        logStepError('layer2_expert', t0, layer2Error);
      }
      throwIfAborted(signal);
    }

    // --- Step 3: Deterministic scoring ---
    t0 = Date.now();
    const deterministicScores = scoreAuditV2(scanResults, siteClassification, {
      auditId: auditRecord.id,
      clientId: resolvedClientId,
      sourceUrl: resolvedWebsiteUrl,
      crawlerAccessData,
      layer1RawScan: scanResults?.extracted_data?.layered_v1_layer1?.site_level_raw_scores || null,
      layer2Expert,
    });
    logStep('deterministic_scoring', t0);
    throwIfAborted(signal);

    // --- Step 4: Extract for LLM ---
    t0 = Date.now();
    const llmData = extractForLLM(scanResults, siteClassification);
    logStep('llm_extract', t0);
    throwIfAborted(signal);

    // --- Step 5: LLM analysis (fallback-safe) ---
    let aiAnalysis = null;
    let llmScore = 0;
    let llmStatus;
    let llmProvider = null;
    let llmDegradedMode = false;

    t0 = Date.now();
    try {
      const messages = buildAuditAnalysisPrompt(llmData);
      const aiResult = await callAiJson({ messages, purpose: 'audit', maxTokens: 4096 });
      throwIfAborted(signal);

      const normalized = normalizeAuditAnalysis(aiResult.data);
      aiAnalysis = normalized.data;
      llmScore = aiAnalysis.llm_comprehension_score || 0;
      llmProvider = aiResult.provider;
      llmStatus = 'available';
      logStep('llm_analysis', t0);
    } catch (aiErr) {
      if (isTimeoutError(aiErr)) {
        throw aiErr;
      }

      llmStatus = 'failed';
      llmDegradedMode = true;
      logStepError('llm_analysis', t0, aiErr);
      console.warn(`[Audit] LLM dégradé — score hybride basé sur déterministe uniquement pour client=${clientId}`);
    }

    throwIfAborted(signal);

    // --- Step 6: Score computation ---
    const deterministicScore = deterministicScores.deterministic_score;
    const llmNormalizedScore = llmScore / 15 * 100;
    const hybridScore = llmDegradedMode
      ? deterministicScore
      : Math.round((deterministicScore * 0.85) + (llmNormalizedScore * 0.15));

    const scoringBreakdown = {
      ...deterministicScores.breakdown,
      deterministic_score: deterministicScore,
      llm_score: llmScore,
      llm_normalized_score: Math.round(llmNormalizedScore),
      hybrid_score: hybridScore,
      llm_weight: llmDegradedMode ? 0 : 0.15,
      deterministic_weight: llmDegradedMode ? 1 : 0.85,
      llm_used: llmStatus === 'available',
      llm_degraded_mode: llmDegradedMode,
    };

    const persistedSeoBreakdown = {
      ...deterministicScores.seo_breakdown,
      overall: {
        ...(deterministicScores.seo_breakdown?.overall || {}),
        deterministic_score: deterministicScore,
        hybrid_score: hybridScore,
        llm_comprehension_score: llmScore,
        llm_status: llmStatus,
        llm_used: llmStatus === 'available',
        llm_degraded_mode: llmDegradedMode,
      },
    };

    const persistedGeoBreakdown = {
      ...deterministicScores.geo_breakdown,
      overall: {
        ...(deterministicScores.geo_breakdown?.overall || {}),
        deterministic_score: deterministicScore,
        hybrid_score: hybridScore,
        llm_comprehension_score: llmScore,
        llm_status: llmStatus,
        llm_used: llmStatus === 'available',
        llm_degraded_mode: llmDegradedMode,
        geo_recommendability: aiAnalysis?.geo_recommendability || 'unclear',
      },
      ai_analysis: {
        status: llmStatus,
        provider: llmProvider,
        llm_used: llmStatus === 'available',
        llm_degraded_mode: llmDegradedMode,
        business_summary: aiAnalysis?.business_summary || null,
        geo_recommendability: aiAnalysis?.geo_recommendability || 'unclear',
        geo_recommendability_rationale: aiAnalysis?.geo_recommendability_rationale || '',
        answerability_summary: aiAnalysis?.answerability_summary || '',
      },
    };

    let savedOpps = [];
    let savedMerge = [];

    // --- Step 6.5: Canonical layered audit object assembly (L3 normalization
    // + L4 wiring). Written under `extracted_data.layered_v1` so every
    // downstream consumer keeps reading the existing top-level fields while
    // operator tooling can introspect the layered structure. ---
    let layeredAudit = null;
    if (layeredEnabled) {
      try {
        layeredAudit = buildLayeredAuditObject({
          target: {
            audit_id: auditRecord.id,
            client_id: resolvedClientId,
            source_url: resolvedWebsiteUrl,
            resolved_url: scanResults.resolved_url || resolvedWebsiteUrl,
          },
          scanResults,
          siteClassification,
          scoring: deterministicScores,
          hybrid: {
            deterministicScore,
            hybridScore,
            llmStatus,
            llmDegradedMode,
          },
          crawlerAccess: crawlerAccessData,
          layer2Expert,
          timings: stepTimings.slice(),
        });

        if (!shadowMode) {
          scanResults.extracted_data = {
            ...scanResults.extracted_data,
            [LAYERED_SCHEMA_KEY]: layeredAudit,
          };
        }
      } catch (buildError) {
        console.warn('[Audit] layered_audit_build_failed', { error: buildError?.message });
      }
    }

    // --- Step 7: Final persist audit status (terminal write first) ---
    t0 = Date.now();
    try {
      const hasFailedPages = scanResults.scanned_pages.some((p) => !p.success);
      const finalStatus = hasFailedPages ? 'partial_error' : 'success';

      await finalizeAuditOnce({
        resolved_url: scanResults.resolved_url,
        scan_status: finalStatus,
        scanned_pages: scanResults.scanned_pages,
        seo_score: deterministicScores.seo_score,
        geo_score: deterministicScores.geo_score,
        seo_breakdown: persistedSeoBreakdown,
        geo_breakdown: persistedGeoBreakdown,
        extracted_data: scanResults.extracted_data,
        issues: deterministicScores.issues,
        strengths: deterministicScores.strengths,
        prefill_suggestions: deterministicScores.automation_data,
        error_message: scanResults.error_message,
      });

      logStep('persist_audit', t0);

      if (sharedCtx.finalStatus === 'failed') {
        return {
          success: false,
          error: 'audit_timeout',
          auditId: auditRecord.id,
          stepTimings,
        };
      }

      // --- Step 8: Opportunities + merge suggestions (only if not timed out) ---
      if (!signal?.aborted && !stopBecauseFinalized()) {
        t0 = Date.now();

        try {
          const opps = generateOpportunities({
            clientId: resolvedClientId,
            auditId: auditRecord.id,
            deterministicIssues: deterministicScores.issues,
            aiOpportunities: aiAnalysis?.opportunities || [],
          });

          if (!stopBecauseFinalized()) {
            savedOpps = await db.createOpportunities(opps);
            await db.archiveOldOpportunitiesExceptAudit(resolvedClientId, auditRecord.id);
          }
        } catch (oppErr) {
          console.error(`[Audit] Opportunities insert failed (non-fatal): ${oppErr.message}`);
        }

        try {
          const mergeSuggs = generateMergeSuggestions({
            clientId: resolvedClientId,
            auditId: auditRecord.id,
            client,
            scanResults,
            aiAnalysis,
            automationData: deterministicScores.automation_data,
          });

          if (!stopBecauseFinalized()) {
            savedMerge = await db.createMergeSuggestions(mergeSuggs);
            await db.archiveOldMergeSuggestionsExceptAudit(resolvedClientId, auditRecord.id);
          }
        } catch (mergeErr) {
          console.error(`[Audit] Merge suggestions insert failed (non-fatal): ${mergeErr.message}`);
        }

        logStep('opportunities_merge', t0);
      }

      const elapsedMs = Date.now() - startMs;

      // Best effort post-finalization log: ne pas risquer une contradiction API/DB.
      db.logAction({
        client_id: resolvedClientId,
        action_type: 'audit_completed',
        details: {
          audit_id: auditRecord.id,
          audit_version: auditVersion,
          layered_pipeline: layeredEnabled,
          shadow_mode: shadowMode,
          seo_score: deterministicScores.seo_score,
          geo_score: deterministicScores.geo_score,
          deterministic_score: deterministicScore,
          hybrid_score: hybridScore,
          overall_score: hybridScore,
          llm_score: llmScore,
          llm_used: llmStatus === 'available',
          llm_degraded_mode: llmDegradedMode,
          llm_status: llmStatus,
          llm_provider: llmProvider,
          pages_scanned: successPages,
          pages_failed: scanResults.scanned_pages.length - successPages,
          opportunities_count: savedOpps.length,
          merge_suggestions_count: savedMerge.length,
          site_type: siteClassification.type,
          elapsed_ms: elapsedMs,
          step_timings: stepTimings,
          crawl_strategy: scanResults?.extracted_data?.layered_v1_layer1?.crawl_metadata?.strategy || null,
          sitemap_sources: scanResults?.extracted_data?.layered_v1_layer1?.crawl_metadata?.sitemap_sources?.length || 0,
          layer1_raw_overall: layeredAudit?.site_level_raw_scores?.overall ?? null,
          layer2_expert_summary: layeredAudit?.subsystem_scores?.layer2_expert_summary?.summary_score ?? null,
        },
      }).catch((logErr) => {
        console.error('[Audit] audit_completed log failed:', logErr.message);
      });

      return {
        success: true,
        auditId: auditRecord.id,
        seo_score: deterministicScores.seo_score,
        geo_score: deterministicScores.geo_score,
        overall_score: hybridScore,
        deterministic_score: deterministicScore,
        llm_score: llmScore,
        scoring_breakdown: scoringBreakdown,
        llmStatus,
        llmDegradedMode,
        summary: aiAnalysis?.business_summary || null,
        geo_recommendability: aiAnalysis?.geo_recommendability || 'unclear',
        opportunitiesCount: savedOpps.length,
        mergeSuggestionsCount: savedMerge.length,
        elapsedMs,
        stepTimings,
      };
    } catch (stepError) {
      if (isTimeoutError(stepError) || stopBecauseFinalized()) {
        return {
          success: false,
          error: 'audit_timeout',
          auditId: auditRecord.id,
          stepTimings,
        };
      }
      throw stepError;
    }
  } catch (err) {
    console.error('[Audit] Fatal error:', err);
    console.error('[Audit] fatal_context', {
      client_id: clientId,
      audit_id: auditRecord?.id || null,
      is_timeout: isTimeoutError(err),
    });

    if (auditRecord?.id && !sharedCtx.finalized) {
      try {
        await finalizeAuditOnce({
          scan_status: 'failed',
          error_message: isTimeoutError(err) ? 'Audit timed out after max duration (global timeout)' : err.message,
        });
      } catch (finalizeError) {
        console.error('[Audit] Failed to finalize errored audit:', finalizeError.message);
      }
    }

    return {
      success: false,
      error: isTimeoutError(err) ? 'audit_timeout' : err.message,
      auditId: auditRecord?.id || null,
      stepTimings,
    };
  } finally {
    sharedCtx.done = true;
  }
}
