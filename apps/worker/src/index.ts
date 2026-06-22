import { processOutboxBatch } from '@squash/server';

const pollInterval = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2_000);
let stopping = false;

async function run() {
  console.info('Squash worker started.');
  while (!stopping) {
    try {
      const processed = await processOutboxBatch();
      if (processed === 0) await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error('Worker batch failed.', error);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}

process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});

void run();
