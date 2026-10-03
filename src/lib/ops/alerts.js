export async function sendSlackAlert({ type, clientId, runId, errorMessage }) {
    const webhookUrl = process.env.SLACK_ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn(`[Alert] No SLACK_ALERT_WEBHOOK_URL configured. Would have sent: [${type}] Client ${clientId} | Run ${runId} | Error: ${errorMessage}`);
        return;
    }

    try {
        const payload = {
            text: `🚨 *Job Final Failure* 🚨\n*Type:* \`${type}\`\n*Client ID:* \`${clientId}\`\n*Run ID:* \`${runId}\`\n*Error:* ${errorMessage}\n*Time:* ${new Date().toISOString()}`,
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error(`[Alert] Failed to send Slack alert: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error(`[Alert] Exception sending Slack alert:`, error);
    }
}
