export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rateLimit';
import { sendContactAutoReplyEmail } from '@/lib/mailer';

const InquirySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(254).trim(),
  message: z.string().min(1).max(1000).trim(),
  captchaToken: z.string().min(1, 'reCAPTCHAトークンが必要です'),
});

const sanitize = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const getIp = (req: Request) =>
  (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() ||
  req.headers.get('x-real-ip') ||
  '0.0.0.0';

async function verifyCaptcha(token: string): Promise<{ success: boolean; score?: number; error?: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('reCAPTCHA secret key is not configured');
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();

    if (!data.success) {
      return { 
        success: false, 
        error: data['error-codes']?.join(', ') || 'Verification failed' 
      };
    }

    const score = data.score ?? 1.0;
    return { success: score >= 0.5, score };
  } catch (error) {
    return { success: false, error: 'Network error during verification' };
  }
}

async function notifySlack(payload: {
  name: string;
  email: string;
  message: string;
  docId: string;
  ip: string;
  ua?: string | null;
}) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎟️ 新しいお問い合わせ', emoji: true },
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*お名前:*\n${payload.name}` },
        { type: 'mrkdwn', text: `*メール:*\n${payload.email}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*内容:*\n${payload.message.substring(0, 1500)}`,
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `Doc ID: \`${payload.docId}\`` },
        { type: 'mrkdwn', text: `IP: \`${payload.ip}\`` },
        { type: 'mrkdwn', text: `UA: \`${(payload.ua || '').slice(0, 80)}\`` },
      ],
    },
  ];

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `新しいお問い合わせ: ${payload.name} <${payload.email}>`,
      blocks,
    }),
  }).catch(() => {});
}

export async function POST(req: Request) {
  try {
    const clientIp = getIp(req);
    
    if (!rateLimit(clientIp, { windowMs: 60_000, max: 10 })) {
      return NextResponse.json({ error: 'リクエストが多すぎます。しばらく経ってからお試しください。' }, { status: 429 });
    }

    const body = await req.json();
    const parsed = InquirySchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: parsed.error.issues 
      }, { status: 400 });
    }

    const { name, email, message, captchaToken } = parsed.data;

    // reCAPTCHA検証（必須）
    const verificationResult = await verifyCaptcha(captchaToken);
    
    if (!verificationResult.success) {
      return NextResponse.json({ 
        error: 'セキュリティチェックに失敗しました。もう一度お試しください。' 
      }, { status: 400 });
    }

    const doc = {
      name: sanitize(name),
      email: sanitize(email),
      message: sanitize(message),
      status: 'open',
      createdAt: new Date(),
      ip: clientIp,
      ua: req.headers.get('user-agent') || '',
      referer: req.headers.get('referer') || '',
    };

    const ref = await adminDb.collection('inquiries').add(doc);

    // 自動返信メール送信
    try {
      await sendContactAutoReplyEmail({
        to: email,
        userName: name,
        message: message,
        submittedAt: doc.createdAt,
      });
    } catch (emailError) {
      // メール送信失敗してもお問い合わせは成功扱い
    }

    // Slack 通知
    await notifySlack({
      name: doc.name,
      email: doc.email,
      message: doc.message,
      docId: ref.id,
      ip: doc.ip,
      ua: doc.ua,
    });

    return NextResponse.json({ success: true, id: ref.id });
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}