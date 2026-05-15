import type { AdminLlmTokenUsageSeriesItem, TokenUsageGraphProps } from './management.types';

const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const CHART_PADDING = 36;
const DATE_MS = 24 * 60 * 60 * 1000;
const PROVIDER_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#d97706', '#0891b2'] as const;

const formatDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const buildDateKeys = (from: string, days: number): string[] => {
  const start = new Date(from);
  return Array.from({ length: days }, (_, index) => formatDateKey(new Date(start.getTime() + index * DATE_MS)));
};

const getSeriesKey = (item: Pick<AdminLlmTokenUsageSeriesItem, 'provider' | 'model'>): string =>
  `${item.provider}:${item.model}`;

const getSeriesLabel = (key: string): string => key.replace(':', ' / ');

const formatNumber = (value: number): string => new Intl.NumberFormat('en-US').format(value);

const buildTotals = (series: readonly AdminLlmTokenUsageSeriesItem[]): AdminLlmTokenUsageSeriesItem[] =>
  Array.from(
    series.reduce((totals, item) => {
      const key = getSeriesKey(item);
      const current = totals.get(key);
      totals.set(key, {
        date: '',
        provider: item.provider,
        model: item.model,
        promptTokens: (current?.promptTokens ?? 0) + item.promptTokens,
        completionTokens: (current?.completionTokens ?? 0) + item.completionTokens,
        totalTokens: (current?.totalTokens ?? 0) + item.totalTokens,
        requestCount: (current?.requestCount ?? 0) + item.requestCount,
        unknownRequestCount: (current?.unknownRequestCount ?? 0) + item.unknownRequestCount,
      });
      return totals;
    }, new Map<string, AdminLlmTokenUsageSeriesItem>()).values()
  ).sort((left, right) => right.totalTokens - left.totalTokens);

const buildUsageLookup = (series: readonly AdminLlmTokenUsageSeriesItem[]): Map<string, number> =>
  series.reduce((lookup, item) => {
    lookup.set(`${getSeriesKey(item)}:${item.date}`, item.totalTokens);
    return lookup;
  }, new Map<string, number>());

const getX = (index: number, dateCount: number): number => {
  const drawableWidth = CHART_WIDTH - CHART_PADDING * 2;
  return dateCount <= 1 ? CHART_PADDING : CHART_PADDING + (index / (dateCount - 1)) * drawableWidth;
};

const getY = (value: number, maxValue: number): number => {
  const drawableHeight = CHART_HEIGHT - CHART_PADDING * 2;
  return CHART_HEIGHT - CHART_PADDING - (value / maxValue) * drawableHeight;
};

const buildLinePath = (values: readonly number[], maxValue: number): string =>
  values
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${getX(index, values.length).toFixed(2)} ${getY(value, maxValue).toFixed(2)}`)
    .join(' ');

export const TokenUsageGraph = ({ usage, status, error }: TokenUsageGraphProps) => {
  if (status === 'loading') {
    return (
      <section className="management-token-usage" aria-label="Model token usage">
        <div className="page-loading management-state">
          <div className="spinner" />
          <p>Loading model usage...</p>
        </div>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="management-token-usage" aria-label="Model token usage">
        <p className="management-alert management-alert--error">{error}</p>
      </section>
    );
  }

  const series = usage?.series ?? [];
  const totals = buildTotals(series);
  const dateKeys = usage ? buildDateKeys(usage.range.from, usage.range.days) : [];
  const usageLookup = buildUsageLookup(series);
  const seriesKeys = totals.map(getSeriesKey);
  const maxTokenValue = Math.max(1, ...series.map((item) => item.totalTokens));
  const yTicks = [...new Set([maxTokenValue, Math.round(maxTokenValue / 2), 0])];
  const totalTokens = totals.reduce((sum, item) => sum + item.totalTokens, 0);
  const totalRequests = totals.reduce((sum, item) => sum + item.requestCount, 0);
  const totalUnknownRequests = totals.reduce((sum, item) => sum + item.unknownRequestCount, 0);

  return (
    <section className="management-token-usage" aria-label="Model token usage">
      <div className="management-token-usage-header">
        <div>
          <p className="management-eyebrow">Model usage</p>
          <h2>Model token usage</h2>
          <p className="management-subtitle">Daily text-generation tokens grouped by provider and model.</p>
        </div>
        <div className="management-token-usage-summary" aria-label="Usage totals">
          <span>{formatNumber(totalTokens)} tokens</span>
          <span>{formatNumber(totalRequests)} requests</span>
          <span>{formatNumber(totalUnknownRequests)} unknown</span>
        </div>
      </div>

      {totals.length === 0 ? (
        <div className="page-empty management-state">
          <p>No model usage recorded yet.</p>
        </div>
      ) : (
        <>
          <div className="management-token-chart-wrap">
            <svg className="management-token-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Daily model token usage">
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={CHART_PADDING}
                    x2={CHART_WIDTH - CHART_PADDING}
                    y1={getY(tick, maxTokenValue)}
                    y2={getY(tick, maxTokenValue)}
                    className="management-token-chart-grid"
                  />
                  <text x={8} y={getY(tick, maxTokenValue) + 4} className="management-token-chart-label">
                    {formatNumber(tick)}
                  </text>
                </g>
              ))}
              {seriesKeys.map((key, index) => {
                const values = dateKeys.map((date) => usageLookup.get(`${key}:${date}`) ?? 0);
                const color = PROVIDER_COLORS[index % PROVIDER_COLORS.length];
                return (
                  <g key={key}>
                    <path d={buildLinePath(values, maxTokenValue)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {values.map((value, valueIndex) => (
                      <circle key={`${key}:${dateKeys[valueIndex]}`} cx={getX(valueIndex, values.length)} cy={getY(value, maxTokenValue)} r="3.5" fill={color}>
                        <title>{`${getSeriesLabel(key)} ${dateKeys[valueIndex]}: ${formatNumber(value)} tokens`}</title>
                      </circle>
                    ))}
                  </g>
                );
              })}
              {dateKeys.length > 0 && (
                <>
                  <text x={CHART_PADDING} y={CHART_HEIGHT - 8} className="management-token-chart-label">
                    {dateKeys[0]}
                  </text>
                  <text x={CHART_WIDTH - CHART_PADDING} y={CHART_HEIGHT - 8} textAnchor="end" className="management-token-chart-label">
                    {dateKeys[dateKeys.length - 1]}
                  </text>
                </>
              )}
            </svg>
          </div>

          <div className="management-token-legend">
            {totals.map((item, index) => (
              <div key={getSeriesKey(item)} className="management-token-legend-item">
                <span className="management-token-legend-swatch" style={{ background: PROVIDER_COLORS[index % PROVIDER_COLORS.length] }} />
                <div>
                  <strong>{item.provider} / {item.model}</strong>
                  <span>
                    {formatNumber(item.totalTokens)} tokens - {formatNumber(item.requestCount)} requests
                    {item.unknownRequestCount > 0 ? ` - ${formatNumber(item.unknownRequestCount)} unknown` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};
