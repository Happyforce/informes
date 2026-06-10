import type { Report } from "@/lib/types";

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ReportCard({
  report,
  showDate = false,
}: {
  report: Report;
  showDate?: boolean;
}) {
  return (
    <article className="card">
      <div className={`card-cover ${report.cover}`}>
        <div className="card-badges">
          {report.badges.map((b) => (
            <span key={b} className="badge">
              {b}
            </span>
          ))}
        </div>
        {report.edition && (
          <div className="card-edition">
            {report.edition}
            {report.edition_label && (
              <span className="edition-label">{report.edition_label}</span>
            )}
          </div>
        )}
      </div>
      <div className="card-body">
        {showDate && (
          <div className="card-meta">
            Publicado el {fmtDate(report.published_at)}
          </div>
        )}
        <h3 className="card-title">{report.title}</h3>
        <p className="card-desc">{report.description}</p>
        {report.stats.length > 0 && (
          <div className="card-stats">
            {report.stats.map((s) => (
              <div key={s.label} className="stat">
                <div className="stat-num">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}
        <div className="card-actions">
          <a className="btn btn-primary" href={`/r/${report.slug}`}>
            Leer informe <span className="arrow">→</span>
          </a>
          {report.canva_url && (
            <a
              className="btn btn-secondary"
              href={report.canva_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver presentación ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
