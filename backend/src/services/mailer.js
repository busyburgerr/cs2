import { config } from '../config.js'

/**
 * Отправка писем. В разработке письмо печатается в консоль — SMTP не нужен,
 * ссылку восстановления видно прямо в логе сервера.
 *
 * Для production подключите провайдера: реализуйте sendViaProvider()
 * (nodemailer / Resend / SES) и задайте MAIL_PROVIDER=smtp.
 */
export async function sendMail({ to, subject, text }) {
  if (config.mail.provider === 'console') {
    console.log(
      ['', '─── ПИСЬМО ───', `кому:  ${to}`, `тема:  ${subject}`, '', text, '──────────────', ''].join(
        '\n',
      ),
    )
    return { delivered: true, transport: 'console' }
  }

  throw new Error(
    `Провайдер писем "${config.mail.provider}" не настроен. ` +
      'Реализуйте отправку в src/services/mailer.js',
  )
}

export function passwordResetLetter({ username, url, ttlMinutes }) {
  return {
    subject: 'Восстановление пароля — CS2 Cases',
    text:
      `Здравствуйте, ${username}!\n\n` +
      `Кто-то запросил восстановление пароля для вашего аккаунта.\n` +
      `Ссылка действует ${ttlMinutes} минут:\n\n${url}\n\n` +
      'Если это были не вы — просто проигнорируйте письмо, пароль останется прежним.',
  }
}
