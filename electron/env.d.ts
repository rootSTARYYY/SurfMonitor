declare module 'nodemailer' {
  export interface SentMessageInfo {
    messageId?: string;
    accepted?: string[];
    rejected?: string[];
    response?: string;
  }

  export interface Transporter {
    verify(): Promise<boolean>;
    sendMail(mailOptions: {
      from?: string;
      to?: string;
      subject?: string;
      text?: string;
      html?: string;
    }): Promise<SentMessageInfo>;
  }

  export function createTransport(options: {
    host: string;
    port: number;
    secure?: boolean;
    requireTLS?: boolean;
    ignoreTLS?: boolean;
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
    auth?: {
      user: string;
      pass: string;
    };
  }): Transporter;
}
