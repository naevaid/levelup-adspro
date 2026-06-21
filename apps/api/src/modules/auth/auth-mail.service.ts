import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class AuthMailService {
  constructor(private readonly configService: ConfigService) {}

  async sendPasswordResetEmail(input: {
    email: string;
    name: string;
    resetUrl: string;
  }) {
    const transport = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT', 465),
      secure: this.isSecureTransport(),
      auth: {
        user: this.configService.get<string>('MAIL_USERNAME'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });

    const fromAddress = this.configService.get<string>('MAIL_FROM_ADDRESS');
    const fromName = this.configService.get<string>('MAIL_FROM_NAME');

    await transport.sendMail({
      from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
      to: input.email,
      subject: 'Reset password LevelUP adsPRO',
      text: [
        `Halo ${input.name},`,
        '',
        'Kami menerima permintaan untuk mengganti password akun LevelUP adsPRO Anda.',
        `Buka tautan berikut untuk membuat password baru: ${input.resetUrl}`,
        '',
        'Jika Anda tidak meminta reset password, abaikan email ini.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <p>Halo ${this.escapeHtml(input.name)},</p>
          <p>Kami menerima permintaan untuk mengganti password akun LevelUP adsPRO Anda.</p>
          <p>
            <a
              href="${this.escapeHtml(input.resetUrl)}"
              style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #fb6a35; color: #ffffff; text-decoration: none; font-weight: 600;"
            >
              Buat Password Baru
            </a>
          </p>
          <p>Jika tombol tidak terbuka, salin tautan ini ke browser Anda:</p>
          <p><a href="${this.escapeHtml(input.resetUrl)}">${this.escapeHtml(input.resetUrl)}</a></p>
          <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
        </div>
      `,
    });
  }

  private isSecureTransport() {
    const encryption = this.configService
      .get<string>('MAIL_ENCRYPTION', 'ssl')
      .toLowerCase();
    const port = this.configService.get<number>('MAIL_PORT', 465);

    return encryption === 'ssl' || port === 465;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
