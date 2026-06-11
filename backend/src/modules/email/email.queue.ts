import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../common/constants/queue.constant';

export const emailQueueRegistration = BullModule.registerQueue({
  name: QUEUE_NAMES.EMAIL,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});
