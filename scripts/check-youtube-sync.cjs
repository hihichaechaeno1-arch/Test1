/** Configuration-only preflight: no SDK, API requests, or database writes. */
const { appendFileSync } = require('node:fs');
const { loadConfig } = require('./fetch-youtube.cjs');

function checkWorkflowConfig(env = process.env) {
  const errors = [];
  if (env.ENABLE_YOUTUBE_SYNC !== 'true') {
    errors.push('Set repository variable ENABLE_YOUTUBE_SYNC to exactly true only after database/security and channel approval.');
  }
  const settings = {
    YOUTUBE_CHANNEL_IDS: 'repository variable',
    YOUTUBE_API_KEY: 'repository secret',
    SUPABASE_URL: 'repository secret',
    SUPABASE_SERVICE_ROLE_KEY: 'repository secret',
  };
  let missing = false;
  for (const [name, kind] of Object.entries(settings)) {
    if (!env[name]?.trim()) {
      errors.push(`Missing ${kind}: ${name}. Configure it under Settings > Secrets and variables > Actions.`);
      missing = true;
    }
  }
  if (!missing) {
    try {
      // Reuse the importer's validation; importing its module never starts a sync.
      loadConfig(env, []);
    } catch (error) {
      // Only fixed classifications escape this boundary, never submitted values.
      errors.push(error instanceof Error && error.message === 'Invalid SUPABASE_URL'
        ? 'SUPABASE_URL must be an explicit HTTPS project origin without credentials, query, or path.'
        : 'YOUTUBE_CHANNEL_IDS must contain approved channel IDs, not names or URLs (comma-separated UC plus 22 valid characters).');
    }
  }
  return errors;
}

module.exports = { checkWorkflowConfig };

if (require.main === module) {
  const errors = checkWorkflowConfig();
  const status = errors.length ? 'Configuration blocked' : 'Configuration ready';
  const summary = [
    `## YouTube sync: ${status}`,
    '',
    ...(errors.length ? errors.map(error => `- ${error}`) : ['Required settings and channel-ID syntax validated; ingestion may proceed.']),
    '',
    'No YouTube requests or database writes were performed by this preflight.',
    '',
    'See docs/SETUP_CONFIGURATION.md and docs/YOUTUBE_SYNC.md. Configuration validation does not verify credentials, channel ownership, or database readiness.',
    '',
  ].join('\n');
  // Messages contain only fixed text and setting names, never configuration values.
  for (const error of errors) console.error(`::error::${error}`);
  if (!errors.length) console.log(status);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (errors.length) process.exitCode = 1;
}
