import type { PublicEventExperiencePayload } from "./experience";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Builds a self-printing HTML document of the event agenda for "Save as PDF". */
export function buildAgendaPdfHtml(args: {
  eventName: string;
  orgName: string;
  periodLabel: string;
  locationLine: string;
  description: string | null;
  experience: PublicEventExperiencePayload;
}): string {
  const { eventName, orgName, periodLabel, locationLine, description, experience } = args;

  const dayBlocks =
    experience.programMode === "PER_DAY"
      ? experience.agendaByDay
          .filter((d) => d.items.length > 0)
          .map(
            (d) => `
              <section class="day">
                <h3>Day ${d.dayIndex}</h3>
                <ol class="agenda">
                  ${d.items
                    .map(
                      (i) => `
                        <li>
                          <span class="time">${escapeHtml(i.time)}</span>
                          <div class="body">
                            <h4>${escapeHtml(i.title)}</h4>
                            ${i.detail?.trim() ? `<p>${escapeHtml(i.detail.trim())}</p>` : ""}
                          </div>
                        </li>`
                    )
                    .join("")}
                </ol>
              </section>`
          )
          .join("")
      : `
          <section class="day">
            <ol class="agenda">
              ${experience.agenda
                .map(
                  (i) => `
                    <li>
                      <span class="time">${escapeHtml(i.time)}</span>
                      <div class="body">
                        <h4>${escapeHtml(i.title)}</h4>
                        ${i.detail?.trim() ? `<p>${escapeHtml(i.detail.trim())}</p>` : ""}
                      </div>
                    </li>`
                )
                .join("")}
            </ol>
          </section>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(eventName)} — Agenda</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  *,*::before,*::after { box-sizing: border-box; }
  html,body { margin: 0; padding: 0; background: #fff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 780px; margin: 0 auto; padding: 56px 56px 80px; }
  header.cover { border-bottom: 2px solid #0f172a; padding-bottom: 24px; margin-bottom: 32px; }
  header.cover .org { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 6px; }
  header.cover h1 { font-size: 30px; line-height: 1.15; margin: 0 0 12px; font-weight: 800; letter-spacing: -0.01em; }
  header.cover .meta { display: flex; flex-wrap: wrap; gap: 14px 28px; font-size: 13px; color: #334155; }
  header.cover .meta strong { color: #0f172a; font-weight: 600; }
  .intro p { font-size: 13px; color: #334155; line-height: 1.55; margin: 0 0 10px; }
  h2.section { font-size: 18px; margin: 32px 0 16px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; font-weight: 700; }
  .day { margin: 0 0 24px; break-inside: avoid; }
  .day h3 { font-size: 15px; margin: 0 0 12px; padding: 6px 10px; background: #f1f5f9; border-radius: 6px; display: inline-block; font-weight: 700; color: #0f172a; }
  ol.agenda { list-style: none; padding: 0; margin: 0; border-left: 2px solid #e2e8f0; }
  ol.agenda li { display: grid; grid-template-columns: 110px 1fr; gap: 14px; padding: 12px 0 12px 16px; margin-left: -2px; border-left: 2px solid transparent; break-inside: avoid; }
  ol.agenda li + li { border-top: 1px dashed #e2e8f0; }
  ol.agenda .time { font-weight: 700; font-size: 12px; color: #0f172a; padding-top: 2px; font-variant-numeric: tabular-nums; }
  ol.agenda h4 { font-size: 14px; margin: 0 0 4px; font-weight: 700; color: #0f172a; }
  ol.agenda p { margin: 0; font-size: 12px; color: #475569; line-height: 1.5; }
  footer.foot { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
  @media print { .page { padding: 24px; } @page { size: A4; margin: 18mm; } }
</style>
</head><body>
<div class="page">
  <header class="cover">
    <div class="org">${escapeHtml(orgName)}</div>
    <h1>${escapeHtml(eventName)}</h1>
    <div class="meta">
      <span><strong>When</strong> · ${escapeHtml(periodLabel)}</span>
      <span><strong>Where</strong> · ${escapeHtml(locationLine)}</span>
    </div>
  </header>
  ${
    description?.trim()
      ? `<section class="intro">${description
          .trim()
          .split(/\n\n+/)
          .map((p) => `<p>${escapeHtml(p)}</p>`)
          .join("")}</section>`
      : ""
  }
  <h2 class="section">Detailed agenda</h2>
  ${dayBlocks || `<p style="font-size:13px;color:#64748b;">No agenda items have been published.</p>`}
  <footer class="foot">
    <span>Generated ${new Date().toLocaleDateString()} · Hosted by ${escapeHtml(orgName)}</span>
    <span>Powered by Eventflow</span>
  </footer>
</div>
<script>
  window.addEventListener("load", function () { setTimeout(function () { window.focus(); window.print(); }, 250); });
</script>
</body></html>`;
}
