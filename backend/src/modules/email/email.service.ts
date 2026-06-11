import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, EMAIL_JOBS } from '../../common/constants/queue.constant';
import type {
  SendVerifyEmailData,
  SendResetPasswordData,
  SendOrderConfirmationData,
  SendOrderStatusUpdateData,
  SendPasswordChangedData,
  OrderItemData,
  ShippingAddressData,
} from './interfaces/email-job.interface';

export type { OrderItemData, ShippingAddressData };

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  async sendVerifyEmail(
    to: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    const data: SendVerifyEmailData = { to, fullName, token };
    await this.emailQueue.add(EMAIL_JOBS.SEND_VERIFY_EMAIL, data);
    this.logger.log(`[EmailService] Queued verify-email for ${to}`);
  }

  async sendResetPassword(
    to: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    const data: SendResetPasswordData = { to, fullName, token };
    await this.emailQueue.add(EMAIL_JOBS.SEND_RESET_PASSWORD, data);
    this.logger.log(`[EmailService] Queued reset-password for ${to}`);
  }

  async sendOrderConfirmation(
    to: string,
    orderData: Omit<SendOrderConfirmationData, 'to'>,
  ): Promise<void> {
    const data: SendOrderConfirmationData = { to, ...orderData };
    await this.emailQueue.add(EMAIL_JOBS.SEND_ORDER_CONFIRMATION, data);
    this.logger.log(
      `[EmailService] Queued order-confirmation for ${to}, order ${orderData.orderCode}`,
    );
  }

  async sendOrderStatusUpdate(
    to: string,
    updateData: Omit<SendOrderStatusUpdateData, 'to'>,
  ): Promise<void> {
    const data: SendOrderStatusUpdateData = { to, ...updateData };
    await this.emailQueue.add(EMAIL_JOBS.SEND_ORDER_STATUS_UPDATE, data);
    this.logger.log(
      `[EmailService] Queued order-status-update for ${to}, order ${updateData.orderCode}`,
    );
  }

  async sendPasswordChanged(
    to: string,
    fullName: string,
    changedAt: string,
  ): Promise<void> {
    const data: SendPasswordChangedData = { to, fullName, changedAt };
    await this.emailQueue.add(EMAIL_JOBS.SEND_PASSWORD_CHANGED, data);
    this.logger.log(`[EmailService] Queued password-changed for ${to}`);
  }
}
