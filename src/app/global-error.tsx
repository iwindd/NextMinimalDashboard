'use client';

import { useEffect } from 'react';
import { Prompt, Sarabun } from 'next/font/google';
import StatusScreen, { StatusActionAnchor, StatusActionButton } from '@/components/StatusScreen';
import './status-document.css';

// The layout fonts are unavailable here, and a Thai fallback cannot be assumed to
// exist on the device, so this file loads the two weights it needs itself.
const prompt = Prompt({
  weight: ['700', '800'],
  subsets: ['latin', 'thai'],
  variable: '--font-prompt',
  display: 'swap',
});

const sarabun = Sarabun({
  weight: ['400', '600'],
  subsets: ['latin', 'thai'],
  variable: '--font-sarabun',
  display: 'swap',
});

/**
 * Last-resort 500 document. It only takes over when a root layout itself fails
 * (`(web)/layout.tsx` or `admin/layout.tsx`), because those sit above every
 * segment-level `error.tsx` boundary. Everything thrown inside a public page is
 * handled by `(web)/error.tsx`, which keeps the site chrome.
 *
 * This file replaces the root layout, so it renders its own `<html>`/`<body>`, loads
 * its own fonts and cannot use the `metadata` export (hence the React `<title>`).
 * It deliberately carries no logo or section links because it is shared by the public
 * site and the admin app.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[app] unhandled error in a root layout', error);
  }, [error]);

  return (
    <html lang="th" className={`${prompt.variable} ${sarabun.variable}`}>
      <body>
        <title>ระบบขัดข้อง (500) — SimpleDashboard Template</title>
        <StatusScreen
          code="500"
          tone="danger"
          layout="standalone"
          links={[]}
          eyebrow="ระบบขัดข้อง"
          title="ขออภัย ระบบไม่พร้อมให้บริการ"
          description="เกิดข้อผิดพลาดที่ทำให้ระบบไม่สามารถแสดงหน้าเว็บได้ กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาอยู่กรุณาแจ้งผู้ดูแลระบบพร้อมรหัสอ้างอิงด้านล่าง"
          reference={error.digest}
        >
          <StatusActionButton onClick={() => retry()}>ลองใหม่อีกครั้ง</StatusActionButton>
          <StatusActionAnchor href="/" variant="ghost">
            กลับหน้าแรก
          </StatusActionAnchor>
        </StatusScreen>
      </body>
    </html>
  );
}
