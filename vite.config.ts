import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: {
          name: 'wig-tracker',
          main: 'vinext/server/fetch-handler',
          compatibility_date: '2026-05-15',
          compatibility_flags: ['nodejs_compat'],
          // Local development storage until Firebase is connected.
          d1_databases: [{ binding: 'DB', database_name: 'wig-tracker-local', database_id: '00000000-0000-4000-8000-000000000000' }],
          r2_buckets: [{ binding: 'FILES', bucket_name: 'wig-tracker-local-files' }],
        },
      }),
    ],
  };
});
