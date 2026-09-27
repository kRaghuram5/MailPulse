import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../config/logger';

interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  body: string;
}

interface SendEmailResult {
  messageId: string;
  previewUrl?: string;
}

let _transporter: nodemailer.Transporter | null = null;

export async function getTransporter(): Promise<nodemailer.Transporter> {
  if (_transporter) return _transporter;

  if (config.smtp.user && config.smtp.password) {
    // Use configured SMTP (Ethereal or real)
    _transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
    });
    logger.info('SMTP transporter created', {
      host: config.smtp.host,
      port: config.smtp.port,
      user: config.smtp.user,
    });
  } else {
    // Auto-create Ethereal test account
    logger.info('No SMTP credentials — creating Ethereal test account');
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info('Ethereal test account created', {
      user: testAccount.user,
      pass: testAccount.pass,
      previewBase: 'https://ethereal.email',
    });
  }

  return _transporter;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.body,
    text: options.body.replace(/<[^>]+>/g, ''), // plain text fallback
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

  if (previewUrl) {
    logger.info('Preview URL (Ethereal)', { url: previewUrl });
  }

  return {
    messageId: info.messageId,
    previewUrl: typeof previewUrl === 'string' ? previewUrl : undefined,
  };
}
