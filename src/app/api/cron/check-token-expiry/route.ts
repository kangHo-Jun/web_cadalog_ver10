import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import nodemailer from 'nodemailer';
import { refreshAccessToken } from '@/lib/cafe24-auth';

const TOKEN_KEY = 'cafe24_tokens';
const ALERT_DAYS = 1; // 하루 전 알림 (목표 B)
const RECIPIENT_EMAIL = 'zartkang@gmail.com';

const REAUTH_URL =
    `https://daesan3833.cafe24api.com/api/v2/oauth/authorize?` +
    `response_type=code&client_id=${process.env.CAFE24_CLIENT_ID}` +
    `&redirect_uri=${process.env.CAFE24_REDIRECT_URI || 'https://web-cadalog-ver10.vercel.app/api/auth/callback'}` +
    `&scope=mall.read_product,mall.write_product`;

async function sendExpiryEmail(daysLeft: number, expiresAt: Date) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not login password)
        },
    });

    const subject =
        daysLeft <= 0
            ? `🚨 [웹카달로그] Cafe24 토큰 만료! 즉시 재인증 필요`
            : `⚠️ [웹카달로그] Cafe24 토큰 ${daysLeft}일 후 만료 예정`;

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: ${daysLeft <= 0 ? '#e53e3e' : '#d97706'};">
        ${daysLeft <= 0 ? '🚨 토큰이 만료되었습니다!' : `⚠️ Cafe24 Refresh Token이 ${daysLeft}일 후 만료됩니다`}
      </h2>

      <p><strong>만료 일시:</strong> ${expiresAt.toLocaleString('ko-KR')}</p>

      <hr style="margin: 20px 0;" />

      <h3>📋 재인증 절차 (3단계)</h3>

      <ol style="line-height: 2;">
        <li>
          <strong>아래 링크 클릭</strong> → Cafe24 로그인 → 권한 승인<br />
          <a href="${REAUTH_URL}" style="color: #3182ce;">[재인증 시작하기]</a>
        </li>
        <li>
          <strong>리다이렉트 URL에서 code= 값 복사</strong><br />
          <code style="background:#f7f7f7;padding:2px 6px;">?code=XXXXXXXXXXXX</code> 부분 복사
        </li>
        <li>
          <strong>Antigravity AI에 붙여넣기</strong><br />
          <code style="background:#f7f7f7;padding:2px 6px;">authorization_code: 복사한코드</code> 입력<br />
          → 나머지는 자동 처리됩니다!
        </li>
      </ol>

      <hr style="margin: 20px 0;" />

      <p style="color: #718096; font-size: 0.9em;">
        이 메일은 daesan3833 웹 카달로그 시스템이 자동 발송했습니다.<br />
        문의: zartkang@gmail.com
      </p>
    </div>
  `;

    await transporter.sendMail({
        from: `"웹카달로그 시스템" <${process.env.GMAIL_USER}>`,
        to: RECIPIENT_EMAIL,
        subject,
        html,
    });
}

export async function GET() {
    try {
        const client = createClient({ url: process.env.KV_REDIS_URL });
        await client.connect();

        const data = await client.get(TOKEN_KEY);
        await client.quit();

        if (!data) {
            return NextResponse.json({ status: 'no_token', message: 'No tokens found in Redis' });
        }

        const tokens = JSON.parse(data);
        const now = Date.now();
        const result: Record<string, unknown> = {};

        // ── 목표 A: access_token 만료 30분 전이면 자동 갱신 ─────────
        const accessExpiresAt = tokens.expires_at ? Number(tokens.expires_at) : null;
        if (accessExpiresAt) {
            const msLeft = accessExpiresAt - now;
            const minLeft = Math.floor(msLeft / (1000 * 60));
            console.log(`🕐 Access Token expires in ${minLeft} minutes`);

            if (msLeft <= 30 * 60 * 1000) {
                console.log('🔄 Access token expiring soon — refreshing...');
                try {
                    await refreshAccessToken();
                    console.log('✅ Access token auto-refreshed');
                    result.access_token_refreshed = true;
                } catch (refreshErr: any) {
                    console.error('❌ Auto-refresh failed:', refreshErr.message);
                    await sendExpiryEmail(-1, new Date(accessExpiresAt));
                    result.access_token_refresh_failed = refreshErr.message;
                }
            } else {
                result.access_token_expires_in_min = minLeft;
            }
        }

        // ── 목표 B: refresh_token 만료 1일 전 알림 ──────────────────
        const refreshExpiresAt = tokens.refresh_token_expires_at
            ? new Date(tokens.refresh_token_expires_at)
            : null;

        if (!refreshExpiresAt) {
            return NextResponse.json({ ...result, status: 'no_refresh_expiry_info' });
        }

        const msRefreshLeft = refreshExpiresAt.getTime() - now;
        const daysLeft = Math.floor(msRefreshLeft / (1000 * 60 * 60 * 24));

        console.log(`🕐 Refresh Token expires at: ${refreshExpiresAt.toISOString()} (${daysLeft} days left)`);

        if (daysLeft <= ALERT_DAYS) {
            await sendExpiryEmail(daysLeft, refreshExpiresAt);
            console.log(`📧 Alert email sent to ${RECIPIENT_EMAIL} (${daysLeft} days left)`);
            return NextResponse.json({
                ...result,
                status: 'refresh_alert_sent',
                daysLeft,
                expiresAt: refreshExpiresAt.toISOString(),
            });
        }

        return NextResponse.json({
            ...result,
            status: 'ok',
            daysLeft,
            expiresAt: refreshExpiresAt.toISOString(),
        });
    } catch (error: any) {
        console.error('❌ Token expiry check failed:', error.message);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
