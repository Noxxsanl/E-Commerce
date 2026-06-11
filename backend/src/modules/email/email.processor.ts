import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { Job } from 'bullmq';
import { QUEUE_NAMES, EMAIL_JOBS } from '../../common/constants/queue.constant';
import type {
  SendVerifyEmailData,
  SendResetPasswordData,
  SendOrderConfirmationData,
  SendOrderStatusUpdateData,
  SendPasswordChangedData,
} from './interfaces/email-job.interface';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case EMAIL_JOBS.SEND_VERIFY_EMAIL:
        await this.handleVerifyEmail(job.data as SendVerifyEmailData);
        break;

      case EMAIL_JOBS.SEND_RESET_PASSWORD:
        await this.handleResetPassword(job.data as SendResetPasswordData);
        break;

      case EMAIL_JOBS.SEND_ORDER_CONFIRMATION:
        await this.handleOrderConfirmation(
          job.data as SendOrderConfirmationData,
        );
        break;

      case EMAIL_JOBS.SEND_ORDER_STATUS_UPDATE:
        await this.handleOrderStatusUpdate(
          job.data as SendOrderStatusUpdateData,
        );
        break;

      case EMAIL_JOBS.SEND_PASSWORD_CHANGED:
        await this.handlePasswordChanged(job.data as SendPasswordChangedData);
        break;

      default:
        this.logger.warn(`[EmailProcessor] Unknown job type: ${job.name}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`[EmailProcessor] Job ${job.name} #${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    const maxAttempts = job.opts.attempts ?? 5;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `[EmailProcessor] Job ${job.name} #${job.id} PERMANENTLY FAILED after ${job.attemptsMade} attempts: ${error.message}`,
        error.stack,
      );
    } else {
      this.logger.warn(
        `[EmailProcessor] Job ${job.name} #${job.id} failed attempt ${job.attemptsMade}/${maxAttempts}: ${error.message}`,
      );
    }
  }

  private async handleVerifyEmail(data: SendVerifyEmailData): Promise<void> {
    const verifyUrl = `${process.env.FRONTEND_URL ?? ''}/verify-email?token=${data.token}`;
    await this.mailerService.sendMail({
      to: data.to,
      subject: 'Xác thực tài khoản của bạn',
      template: 'verify-email',
      context: {
        fullName: data.fullName,
        verifyUrl,
        expiresInMinutes: 60,
      },
    });
  }

  private async handleResetPassword(
    data: SendResetPasswordData,
  ): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL ?? ''}/reset-password?token=${data.token}`;
    await this.mailerService.sendMail({
      to: data.to,
      subject: 'Đặt lại mật khẩu',
      template: 'reset-password',
      context: {
        fullName: data.fullName,
        resetUrl,
        expiresInMinutes: 60,
      },
    });
  }

  private async handleOrderConfirmation(
    data: SendOrderConfirmationData,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: data.to,
      subject: `Xác nhận đơn hàng #${data.orderCode}`,
      template: 'order-confirmation',
      context: {
        fullName: data.fullName,
        orderCode: data.orderCode,
        orderUrl: data.orderUrl,
        items: data.items,
        subtotal: data.subtotal.toLocaleString('vi-VN'),
        shippingFee: data.shippingFee.toLocaleString('vi-VN'),
        total: data.total.toLocaleString('vi-VN'),
        shippingAddress: data.shippingAddress,
      },
    });
  }

  private async handleOrderStatusUpdate(
    data: SendOrderStatusUpdateData,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: data.to,
      subject: `Cập nhật trạng thái đơn hàng #${data.orderCode}`,
      template: 'order-status-update',
      context: {
        fullName: data.fullName,
        orderCode: data.orderCode,
        orderUrl: data.orderUrl,
        newStatus: data.newStatus,
        statusMessage: data.statusMessage,
        note: data.note,
      },
    });
  }

  private async handlePasswordChanged(
    data: SendPasswordChangedData,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: data.to,
      subject: 'Mật khẩu của bạn đã được thay đổi',
      template: 'password-changed',
      context: {
        fullName: data.fullName,
        changedAt: data.changedAt,
      },
    });
  }
}
