import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  QUEUE_NAMES,
  ANALYTICS_JOBS,
} from '../../common/constants/queue.constant';
import { ProductsRepository } from './products.repository';

interface TrackViewData {
  productId: string;
  sessionId?: string;
}

@Processor(QUEUE_NAMES.ANALYTICS)
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly productsRepository: ProductsRepository) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case ANALYTICS_JOBS.TRACK_VIEW: {
        const data = job.data as TrackViewData;
        const product = await this.productsRepository.findById(data.productId);
        if (product) {
          await this.productsRepository.updateStats(data.productId, {
            viewCount: product.viewCount + 1,
          });
        }
        break;
      }
      default:
        this.logger.warn(`[AnalyticsProcessor] Unknown job type: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.warn(
      `[AnalyticsProcessor] Job ${job.name} #${job.id} failed: ${error.message}`,
    );
  }
}
