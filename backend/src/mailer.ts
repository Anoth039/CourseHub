import nodemailer, { Transporter } from 'nodemailer';

/** Egy várólistáról előléptetett hallgató adatai az értesítő e-mailhez. */
export interface PromotedInfo {
  studentName: string;
  studentEmail: string;
  courseCode: string;
  courseTitle: string;
  lectureLabel: string;
  practiceLabel: string;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000; // 5 s, 10 s, ...

let transporter: Transporter | null | undefined; // undefined = még nem inicializált, null = kikapcsolva

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, ''); // a Google szóközökkel mutatja az app jelszót
  if (!user || !pass) {
    console.warn('[mail] SMTP_USER/SMTP_PASS nincs beállítva – e-mail értesítés kikapcsolva.');
    return (transporter = null);
  }
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465, // 465 = TLS, 587 = STARTTLS
    auth: { user, pass },
    // a lassú/hibás szolgáltató ne akaszthasson fel semmit
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });
  return transporter;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Átmeneti hiba? (hálózat, időtúllépés, 4xx SMTP kód) – ezeket érdemes újrapróbálni. */
function isTransient(err: any): boolean {
  const code = err?.responseCode;
  if (typeof code === 'number') return code >= 400 && code < 500; // 5xx (pl. 535 rossz jelszó, 550 érvénytelen cím) végleges
  return ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ESOCKET', 'EDNS', 'EAI_AGAIN'].includes(err?.code);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendOne(p: PromotedInfo): Promise<void> {
  const t = getTransporter();
  if (!t) return;

  const subject = `Bekerültél a(z) ${p.courseCode} kurzusra – ${p.courseTitle}`;
  const text =
    `Kedves ${p.studentName}!\n\n` +
    `A várólistán felszabadult egy hely, ezért automatikusan felvettünk a következő kurzusra:\n\n` +
    `${p.courseCode} – ${p.courseTitle}\n` +
    `Előadás: ${p.lectureLabel}\n` +
    `Gyakorlat: ${p.practiceLabel}\n\n` +
    `Ha nem kéred a tárgyat, a CourseHubban leiratkozhatsz.\n`;
  const html =
    `<p>Kedves ${esc(p.studentName)}!</p>` +
    `<p>A várólistán felszabadult egy hely, ezért automatikusan felvettünk a következő kurzusra:</p>` +
    `<p><b>${esc(p.courseCode)} – ${esc(p.courseTitle)}</b><br>` +
    `Előadás: ${esc(p.lectureLabel)}<br>Gyakorlat: ${esc(p.practiceLabel)}</p>` +
    `<p>Ha nem kéred a tárgyat, a CourseHub-ban leiratkozhatsz.</p>`;

  for (let attempt = 1; ; attempt++) {
    try {
      const info = await t.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: p.studentEmail,
        subject, text, html
      });
      // a Gmail 250-nel nyugtáz, de címzett-hibát (rejected) külön jelezhet
      if (info.rejected?.length) {
        console.error(`[mail] ${p.studentEmail}: a szolgáltató elutasította a címzettet`, info.rejected);
      }
      return;
    } catch (err: any) {
      const retry = isTransient(err) && attempt < MAX_ATTEMPTS;
      console.error(
        `[mail] ${p.studentEmail}: küldési hiba (${attempt}/${MAX_ATTEMPTS})` +
        ` code=${err?.code ?? '-'} smtp=${err?.responseCode ?? '-'}: ${err?.message}` +
        (retry ? ' – újrapróbálás' : ' – feladom'),
      );
      if (!retry) return;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}

/**
 * E-mail értesítés az előléptetett hallgatóknak. TÖRTÉNJEN a tranzakció commitja UTÁN,
 * és a hívó NE várja meg (fire-and-forget): a szolgáltató hibája, lassúsága vagy hibás
 * válasza soha nem borítja fel a leiratkozást/csoportváltást, és nem lassítja a választ.
 * Ez a függvény sosem dob kivételt.
 */
export function notifyPromoted(list: PromotedInfo[]): void {
  if (!list.length) return;
  void (async () => {
    for (const p of list) {
      try { await sendOne(p); } catch (e) { console.error('[mail] váratlan hiba', e); }
    }
  })();
}

/** Indításkor opcionálisan kipróbálható: a Gmail-beállítás helyes-e. */
export async function verifyMailer(): Promise<void> {
  const t = getTransporter();
  if (!t) return;
  try { await t.verify(); console.log('[mail] SMTP kapcsolat rendben.'); }
  catch (e: any) { console.error('[mail] SMTP ellenőrzés sikertelen:', e?.message); }
}
