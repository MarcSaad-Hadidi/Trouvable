import { createHash } from 'node:crypto';

const SKILL_DOCUMENTS = {
    'api-catalog': `---
name: api-catalog
description: Discover Trouvable API capabilities through the API catalog, OpenAPI description, and health endpoint.
---

# API Catalog

Use this skill when an agent needs to discover or verify public API metadata for Trouvable.

## Discovery Flow

1. Read \`/.well-known/api-catalog\`.
2. Follow \`service-desc\` to \`/.well-known/openapi.json\` for machine-readable operations.
3. Follow \`service-doc\` to \`/docs/api\` for human-readable usage guidance.
4. Follow \`status\` to \`/api/health\` to verify service readiness.
`,
    'site-navigation': `---
name: site-navigation
description: Navigate Trouvable public pages and key operational endpoints.
---

# Site Navigation

Use this skill for high-level orientation and first-contact discovery.

## Key Paths

- Homepage: \`/\`
- Contact page: \`/contact\`
- API documentation: \`/docs/api\`
- API catalog: \`/.well-known/api-catalog\`
- Agent card: \`/.well-known/agent-card.json\`
`,
};

function digest(content) {
    return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

export function getAgentSkill(name) {
    if (!name) return null;
    const normalized = String(name).trim().toLowerCase();
    return SKILL_DOCUMENTS[normalized] || null;
}

export function getAgentSkillEntries(baseUrl) {
    const skills = [];

    for (const [name, content] of Object.entries(SKILL_DOCUMENTS)) {
        skills.push({
            name,
            type: 'skill-md',
            description: extractDescription(content),
            url: `${baseUrl}/.well-known/agent-skills/${name}/SKILL.md`,
            digest: digest(content),
        });
    }

    return skills;
}

function extractDescription(skillMarkdown) {
    const match = skillMarkdown.match(/^\s*description:\s*(.+)$/m);
    if (!match) return '';
    return match[1].trim();
}
