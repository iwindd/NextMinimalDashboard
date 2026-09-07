import type { Metadata } from 'next';
import { Prompt, Sarabun } from 'next/font/google';
import StatusScreen, { StatusActionLink } from '@/components/StatusScreen';
import './status-document.css';

const prompt = Prompt({
  weight: ['600', '700', '800'],
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

export const metadata: Metadata = {
  title: 'ไม่พบหน้าที่ต้องการ (404) — SimpleDashboard Template',
  description: 'ที่อยู่เว็บที่เรียกดูไม่มีอยู่ในระบบ',
};

/**
 * Global 404 for URLs that do not match any route.
 *
 * The app has two separate root layouts (`(web)` and `admin`) and no `app/layout.tsx`,
 * so there is no single layout Next.js can compose an unmatched-route 404 from. This is
 * the case `global-not-found.tsx` exists for; it is enabled through
 * `experimental.globalNotFound` in `next.config.ts`.
 *
 * Because it bypasses the root layout it must render a complete document and load its
 * own fonts and styles. Route-level `notFound()` calls inside `(web)` are handled by
 * `(web)/not-found.tsx`, which keeps the site nav and footer.
 */
export default function GlobalNotFound() {
  return (
    <html lang="th" className={`${prompt.variable} ${sarabun.variable}`}>
      <body>
        <StatusScreen
          code="404"
          layout="standalone"
          brand
          eyebrow="ไม่พบที่อยู่เว็บนี้"
          title="ขออภัย เราหาหน้านี้ไม่พบ"
          description="ที่อยู่เว็บที่คุณเรียกดูไม่มีอยู่ในระบบ อาจพิมพ์ที่อยู่ไม่ครบถ้วน หรือลิงก์ที่ใช้หมดอายุแล้ว ลองเริ่มจากหน้าแรกของ SimpleDashboard Template ได้เลย"
        >
          <StatusActionLink href="/">กลับหน้าแรก</StatusActionLink>
          <StatusActionLink href="/map" variant="ghost">
            ติดต่อเรา
          </StatusActionLink>
        </StatusScreen>
      </body>
    </html>
  );
}
