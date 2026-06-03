export function RouteLoadingFallback() {
  return (
    <div className="route-loading" aria-live="polite" aria-busy="true">
      <div className="route-loading-hero">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-subtitle" />
      </div>

      <div className="route-loading-grid">
        <div className="skeleton-card">
          <div className="skeleton skeleton-chip" />
          <div className="skeleton skeleton-value" />
          <div className="skeleton skeleton-line" />
        </div>
        <div className="skeleton-card">
          <div className="skeleton skeleton-chip" />
          <div className="skeleton skeleton-value" />
          <div className="skeleton skeleton-line" />
        </div>
        <div className="skeleton-card">
          <div className="skeleton skeleton-chip" />
          <div className="skeleton skeleton-value" />
          <div className="skeleton skeleton-line" />
        </div>
      </div>

      <div className="skeleton-panel">
        <div className="skeleton skeleton-panel-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  );
}
