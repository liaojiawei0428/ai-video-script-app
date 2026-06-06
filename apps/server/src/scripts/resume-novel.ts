import { scriptService } from '../services/scriptService';
import { logger } from '../utils/logger';

const NOVEL_ID = '4d7e5c2f-e0e5-427d-b869-d5b3dc1f00a3';
const TARGET_DURATION = 120;

async function main() {
  logger.info('Resuming novel episode generation', { novelId: NOVEL_ID, targetDuration: TARGET_DURATION });
  const task = await scriptService.continueEpisodeGeneration(NOVEL_ID, TARGET_DURATION);
  logger.info('Resume task created', { taskId: task.id, status: task.status });
  console.log('OK', task.id, task.status);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    logger.error('Resume failed', { error: e?.message || String(e), stack: e?.stack });
    console.error('ERR', e?.message || e);
    process.exit(1);
  });
