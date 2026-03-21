import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface ReceiptData {
  transactionId: string;
  currency: string;
  type: 'BUY' | 'SELL';
  amount: number;
  rate: number;
  total: number;
  timestamp: Date;
  bureauName: string;
}

function buildReceiptHtml(data: ReceiptData): string {
  const typeLabel = data.type === 'BUY' ? 'Bought Foreign Currency' : 'Sold Foreign Currency';
  const typeColor = data.type === 'BUY' ? '#2563eb' : '#d97706';
  const formattedDate = data.timestamp.toLocaleString('en-CA', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exchange Receipt</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:#16a34a;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;text-align:center;line-height:40px;font-weight:bold;color:#fff;font-size:14px;">CB</div>
                  <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${data.bureauName}</h1>
                  <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Exchange Receipt</p>
                </td>
                <td align="right">
                  <span style="background:rgba(255,255,255,0.2);color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${data.type}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your transaction has been completed successfully.</p>
            <!-- Transaction ID -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f9fafb;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="padding:12px 16px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Transaction ID</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-family:monospace;font-size:13px;color:#374151;">${data.transactionId}</td>
              </tr>
            </table>
            <!-- Details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:10px 0;font-size:13px;color:#6b7280;">Transaction Type</td>
                <td style="padding:10px 0;font-size:13px;font-weight:600;color:${typeColor};text-align:right;">${typeLabel}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:10px 0;font-size:13px;color:#6b7280;">Currency</td>
                <td style="padding:10px 0;font-size:13px;font-weight:600;color:#111827;text-align:right;">${data.currency}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:10px 0;font-size:13px;color:#6b7280;">Foreign Amount</td>
                <td style="padding:10px 0;font-size:13px;font-weight:600;color:#111827;text-align:right;">${data.amount.toLocaleString('en-CA', { maximumFractionDigits: 2 })} ${data.currency}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:10px 0;font-size:13px;color:#6b7280;">Exchange Rate</td>
                <td style="padding:10px 0;font-size:13px;font-weight:600;color:#111827;text-align:right;">1 CAD = ${data.rate.toFixed(4)} ${data.currency}</td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:10px 0;font-size:13px;color:#6b7280;">Date &amp; Time</td>
                <td style="padding:10px 0;font-size:13px;color:#6b7280;text-align:right;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding:14px 0 0;font-size:14px;font-weight:700;color:#111827;">Total (CAD)</td>
                <td style="padding:14px 0 0;font-size:22px;font-weight:800;color:#16a34a;text-align:right;">$${data.total.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">Thank you for your business. Please retain this receipt for your records.</p>
            <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;text-align:center;">${data.bureauName} &mdash; Currency Exchange Bureau</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendReceiptEmail(
  to: string,
  data: ReceiptData
): Promise<void> {
  await resend.emails.send({
    from: process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
    to,
    subject: `Your exchange receipt — ${data.bureauName}`,
    html: buildReceiptHtml(data),
  });
}
