import { MANAGEMENT_TOKEN_USAGE_DAYS } from './management.consts';
import type {
  AdminLlmTokenUsageOperationItem,
  AdminLlmTokenUsageOperationSeriesItem,
  AdminLlmTokenUsageSeriesItem,
  AdminLlmTokenUsageUserAverageSeriesItem,
  TokenUsageGraphProps,
} from './management.types';

const CHART_WIDTH = 420;
const CHART_HEIGHT = 220;
const CHART_PADDING_TOP = 18;
const CHART_PADDING_RIGHT = 50;
const CHART_PADDING_BOTTOM = 34;
const CHART_PADDING_LEFT = 18;
const DATE_MS = 24 * 60 * 60 * 1000;
const SERIES_COLORS = ['#1a73e8', '#12b5cb', '#e52592', '#fa4b12', '#34a853', '#fbbc04', '#a142f4', '#f29900'] as const;

type ModelUsageTotal = Omit<AdminLlmTokenUsageSeriesItem, 'date'>;
type ModelMetric = 'totalTokens' | 'promptTokens' | 'completionTokens' | 'requestCount' | 'unknownRequestCount' | 'errorCount';

interface ChartLine {
  key: string;
  label: string;
  values: number[];
  legendValue: number;
  color: string;
}

interface MetricLineChartProps {
  title: string;
  subtitle: string;
  dateKeys: readonly string[];
  lines: readonly ChartLine[];
  emptyMessage: string;
  valueFormatter?: (value: number) => string;
}

const formatDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const buildDateKeys = (from: string, days: number): string[] => {
  const start = new Date(from);
  return Array.from({ length: days }, (_, index) => formatDateKey(new Date(start.getTime() + index * DATE_MS)));
};

const formatNumber = (value: number): string => new Intl.NumberFormat('en-US').format(value);

const formatCompactNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const formatAverage = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);

const formatDateLabel = (dateKey: string): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${dateKey}T00:00:00.000Z`));

const getModelKey = (item: Pick<AdminLlmTokenUsageSeriesItem, 'provider' | 'model'>): string =>
  `${item.provider}:${item.model}`;

const getModelLabel = (item: Pick<ModelUsageTotal, 'provider' | 'model'>): string => `${item.provider} / ${item.model}`;

const getOperationKey = (item: Pick<AdminLlmTokenUsageOperationItem, 'sourceService' | 'operation'>): string =>
  `${item.sourceService}:${item.operation}`;

const getOperationLabel = (item: Pick<AdminLlmTokenUsageOperationItem, 'sourceService' | 'operation'>): string =>
  `${item.sourceService} / ${item.operation}`;

const buildTotals = (series: readonly AdminLlmTokenUsageSeriesItem[]): ModelUsageTotal[] =>
  Array.from(
    series.reduce((totals, item) => {
      const key = getModelKey(item);
      const current = totals.get(key);
      totals.set(key, {
        provider: item.provider,
        model: item.model,
        promptTokens: (current?.promptTokens ?? 0) + item.promptTokens,
        completionTokens: (current?.completionTokens ?? 0) + item.completionTokens,
        totalTokens: (current?.totalTokens ?? 0) + item.totalTokens,
        requestCount: (current?.requestCount ?? 0) + item.requestCount,
        unknownRequestCount: (current?.unknownRequestCount ?? 0) + item.unknownRequestCount,
        errorCount: (current?.errorCount ?? 0) + item.errorCount,
      });
      return totals;
    }, new Map<string, ModelUsageTotal>()).values()
  ).sort((left, right) => right.totalTokens - left.totalTokens);

const buildModelLookup = (series: readonly AdminLlmTokenUsageSeriesItem[]): Map<string, AdminLlmTokenUsageSeriesItem> =>
  series.reduce((lookup, item) => {
    lookup.set(`${getModelKey(item)}:${item.date}`, item);
    return lookup;
  }, new Map<string, AdminLlmTokenUsageSeriesItem>());

const buildOperationLookup = (
  operationSeries: readonly AdminLlmTokenUsageOperationSeriesItem[]
): Map<string, AdminLlmTokenUsageOperationSeriesItem> =>
  operationSeries.reduce((lookup, item) => {
    lookup.set(`${getOperationKey(item)}:${item.date}`, item);
    return lookup;
  }, new Map<string, AdminLlmTokenUsageOperationSeriesItem>());

const buildModelLines = (
  totals: readonly ModelUsageTotal[],
  lookup: ReadonlyMap<string, AdminLlmTokenUsageSeriesItem>,
  dateKeys: readonly string[],
  metric: ModelMetric,
  includeLine: (total: ModelUsageTotal) => boolean
): ChartLine[] =>
  totals
    .filter(includeLine)
    .map((total, index) => {
      const key = getModelKey(total);
      return {
        key,
        label: getModelLabel(total),
        values: dateKeys.map((date) => lookup.get(`${key}:${date}`)?.[metric] ?? 0),
        legendValue: total[metric],
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      };
    });

const buildAverageModelLines = (
  totals: readonly ModelUsageTotal[],
  lookup: ReadonlyMap<string, AdminLlmTokenUsageSeriesItem>,
  dateKeys: readonly string[]
): ChartLine[] =>
  totals
    .filter((total) => total.requestCount > 0)
    .map((total, index) => {
      const key = getModelKey(total);
      return {
        key,
        label: getModelLabel(total),
        values: dateKeys.map((date) => {
          const item = lookup.get(`${key}:${date}`);
          return item && item.requestCount > 0 ? item.totalTokens / item.requestCount : 0;
        }),
        legendValue: total.totalTokens / total.requestCount,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      };
    });

const buildOperationLines = (
  operationBreakdown: readonly AdminLlmTokenUsageOperationItem[],
  operationSeries: readonly AdminLlmTokenUsageOperationSeriesItem[],
  dateKeys: readonly string[]
): ChartLine[] => {
  const lookup = buildOperationLookup(operationSeries);

  return operationBreakdown
    .filter((item) => item.totalTokens > 0)
    .map((item, index) => {
      const key = getOperationKey(item);
      return {
        key,
        label: getOperationLabel(item),
        values: dateKeys.map((date) => lookup.get(`${key}:${date}`)?.totalTokens ?? 0),
        legendValue: item.totalTokens,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      };
    });
};

const buildAverageUsagePerUserLines = (
  userAverageSeries: readonly AdminLlmTokenUsageUserAverageSeriesItem[],
  dateKeys: readonly string[]
): ChartLine[] => {
  const lookup = userAverageSeries.reduce((currentLookup, item) => {
    currentLookup.set(item.date, item);
    return currentLookup;
  }, new Map<string, AdminLlmTokenUsageUserAverageSeriesItem>());
  const totalTokens = userAverageSeries.reduce((sum, item) => sum + item.totalTokens, 0);
  const activeUserDays = userAverageSeries.reduce((sum, item) => sum + item.activeUserCount, 0);
  const legendValue = activeUserDays > 0 ? totalTokens / activeUserDays : 0;

  if (legendValue <= 0) {
    return [];
  }

  return [
    {
      key: 'average-api-usage-per-user',
      label: 'Average per active user',
      values: dateKeys.map((date) => lookup.get(date)?.averageTokensPerUser ?? 0),
      legendValue,
      color: SERIES_COLORS[4],
    },
  ];
};

const buildActiveUserLines = (
  userAverageSeries: readonly AdminLlmTokenUsageUserAverageSeriesItem[],
  dateKeys: readonly string[]
): ChartLine[] => {
  const lookup = userAverageSeries.reduce((currentLookup, item) => {
    currentLookup.set(item.date, item);
    return currentLookup;
  }, new Map<string, AdminLlmTokenUsageUserAverageSeriesItem>());
  const activeUserDays = userAverageSeries.reduce((sum, item) => sum + item.activeUserCount, 0);

  if (activeUserDays <= 0) {
    return [];
  }

  return [
    {
      key: 'users-with-api-usage',
      label: 'Users with usage',
      values: dateKeys.map((date) => lookup.get(date)?.activeUserCount ?? 0),
      legendValue: activeUserDays,
      color: SERIES_COLORS[4],
    },
  ];
};

const getX = (index: number, dateCount: number): number => {
  const drawableWidth = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  return dateCount <= 1 ? CHART_PADDING_LEFT : CHART_PADDING_LEFT + (index / (dateCount - 1)) * drawableWidth;
};

const getY = (value: number, maxValue: number): number => {
  const drawableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  return CHART_HEIGHT - CHART_PADDING_BOTTOM - (value / maxValue) * drawableHeight;
};

const buildLinePath = (values: readonly number[], maxValue: number): string =>
  values
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${getX(index, values.length).toFixed(2)} ${getY(value, maxValue).toFixed(2)}`)
    .join(' ');

const buildYTicks = (maxValue: number): number[] =>
  [...new Set([maxValue, maxValue / 2, 0])];

const MetricLineChart = ({ title, subtitle, dateKeys, lines, emptyMessage, valueFormatter = formatCompactNumber }: MetricLineChartProps) => {
  const maxValue = Math.max(1, ...lines.flatMap((line) => line.values));
  const yTicks = buildYTicks(maxValue);

  return (
    <article className="management-graph-card">
      <div className="management-graph-card-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className="management-graph-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>

      {lines.length === 0 ? (
        <p className="management-graph-empty">{emptyMessage}</p>
      ) : (
        <>
          <div className="management-graph-chart-wrap">
            <svg className="management-graph-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={title}>
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={CHART_PADDING_LEFT}
                    x2={CHART_WIDTH - CHART_PADDING_RIGHT}
                    y1={getY(tick, maxValue)}
                    y2={getY(tick, maxValue)}
                    className="management-graph-grid-line"
                  />
                  <text x={CHART_WIDTH - 6} y={getY(tick, maxValue) + 4} textAnchor="end" className="management-graph-label">
                    {valueFormatter(tick)}
                  </text>
                </g>
              ))}
              {lines.map((line) => (
                <g key={line.key}>
                  <path d={buildLinePath(line.values, maxValue)} fill="none" stroke={line.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  {line.values.map((value, valueIndex) => (
                    <circle key={`${line.key}:${dateKeys[valueIndex]}`} cx={getX(valueIndex, line.values.length)} cy={getY(value, maxValue)} r="2.6" fill={line.color}>
                      <title>{`${line.label} ${dateKeys[valueIndex]}: ${valueFormatter(value)}`}</title>
                    </circle>
                  ))}
                </g>
              ))}
              {dateKeys.length > 0 && (
                <>
                  <text x={CHART_PADDING_LEFT} y={CHART_HEIGHT - 8} className="management-graph-label">
                    {formatDateLabel(dateKeys[0])}
                  </text>
                  <text x={CHART_WIDTH - CHART_PADDING_RIGHT} y={CHART_HEIGHT - 8} textAnchor="end" className="management-graph-label">
                    {formatDateLabel(dateKeys[dateKeys.length - 1])}
                  </text>
                </>
              )}
            </svg>
          </div>

          <div className="management-graph-legend">
            {lines.map((line) => (
              <div key={line.key} className="management-graph-legend-item">
                <span className="management-graph-legend-swatch" style={{ background: line.color }} />
                <span>{line.label}</span>
                <strong>{valueFormatter(line.legendValue)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  );
};

export const TokenUsageGraph = ({ usage, status, error, selectedDays, onSelectedDaysChange }: TokenUsageGraphProps) => {
  const series = usage?.series ?? [];
  const operationBreakdown = usage?.operationBreakdown ?? [];
  const operationSeries = usage?.operationSeries ?? [];
  const userAverageSeries = usage?.userAverageSeries ?? [];
  const totals = buildTotals(series);
  const dateKeys = usage ? buildDateKeys(usage.range.from, usage.range.days) : [];
  const modelLookup = buildModelLookup(series);
  const totalTokens = totals.reduce((sum, item) => sum + item.totalTokens, 0);
  const totalRequests = totals.reduce((sum, item) => sum + item.requestCount, 0);
  const totalUnknownRequests = totals.reduce((sum, item) => sum + item.unknownRequestCount, 0);
  const totalErrors = totals.reduce((sum, item) => sum + item.errorCount, 0);

  return (
    <section className="management-token-usage" aria-label="Model token usage">
      <div className="management-token-usage-header">
        <div>
          <p className="management-eyebrow">Model usage</p>
          <h2>Generate content & Live API</h2>
          <p className="management-subtitle">Text-generation usage grouped by provider, model, and operation.</p>
        </div>
        <div className="management-token-usage-actions">
          <div className="management-token-range" role="group" aria-label="Token usage date range">
            {MANAGEMENT_TOKEN_USAGE_DAYS.map((days) => (
              <button
                key={days}
                type="button"
                className={`management-range-button${selectedDays === days ? ' management-range-button--active' : ''}`}
                onClick={() => onSelectedDaysChange(days)}
              >
                {days}d
              </button>
            ))}
          </div>
          {status === 'success' && (
            <div className="management-token-usage-summary" aria-label="Usage totals">
              <span>{formatNumber(totalTokens)} tokens</span>
              <span>{formatNumber(totalRequests)} requests</span>
              <span>{formatNumber(totalUnknownRequests)} unknown-token requests</span>
              <span>{formatNumber(totalErrors)} errors</span>
            </div>
          )}
        </div>
      </div>

      {status === 'loading' && (
        <div className="page-loading management-state">
          <div className="spinner" />
          <p>Loading model usage...</p>
        </div>
      )}

      {status === 'error' && <p className="management-alert management-alert--error">{error}</p>}

      {status === 'success' && totals.length === 0 && (
        <div className="page-empty management-state">
          <p>No model usage recorded yet.</p>
        </div>
      )}

      {status === 'success' && totals.length > 0 && (
        <div className="management-graph-grid">
          <MetricLineChart
            title="Total Tokens per model"
            subtitle="Daily total tokens by model."
            dateKeys={dateKeys}
            lines={buildModelLines(totals, modelLookup, dateKeys, 'totalTokens', (total) => total.totalTokens > 0)}
            emptyMessage="No token usage recorded."
          />
          <MetricLineChart
            title="Input Tokens per model"
            subtitle="Daily prompt tokens by model."
            dateKeys={dateKeys}
            lines={buildModelLines(totals, modelLookup, dateKeys, 'promptTokens', (total) => total.promptTokens > 0)}
            emptyMessage="No input token usage recorded."
          />
          <MetricLineChart
            title="Output Tokens per model"
            subtitle="Daily completion tokens by model."
            dateKeys={dateKeys}
            lines={buildModelLines(totals, modelLookup, dateKeys, 'completionTokens', (total) => total.completionTokens > 0)}
            emptyMessage="No output token usage recorded."
          />
          <MetricLineChart
            title="Requests per model"
            subtitle="Daily request volume by model."
            dateKeys={dateKeys}
            lines={buildModelLines(totals, modelLookup, dateKeys, 'requestCount', (total) => total.requestCount > 0)}
            emptyMessage="No model requests recorded."
          />
          <MetricLineChart
            title="Average token usage per request"
            subtitle="Daily total tokens divided by requests."
            dateKeys={dateKeys}
            lines={buildAverageModelLines(totals, modelLookup, dateKeys)}
            emptyMessage="No average token usage recorded."
            valueFormatter={formatAverage}
          />
          <MetricLineChart
            title="Errors per model"
            subtitle="Daily failed provider attempts by model."
            dateKeys={dateKeys}
            lines={buildModelLines(totals, modelLookup, dateKeys, 'errorCount', (total) => total.errorCount > 0)}
            emptyMessage="No model errors recorded."
            valueFormatter={formatNumber}
          />
          <MetricLineChart
            title="Users with API usage"
            subtitle="Daily users with at least one API request."
            dateKeys={dateKeys}
            lines={buildActiveUserLines(userAverageSeries, dateKeys)}
            emptyMessage="No users with API usage recorded yet."
            valueFormatter={formatNumber}
          />
          <MetricLineChart
            title="Average API usage per user"
            subtitle="Daily tokens divided by active users."
            dateKeys={dateKeys}
            lines={buildAverageUsagePerUserLines(userAverageSeries, dateKeys)}
            emptyMessage="No user-level API usage recorded yet."
            valueFormatter={formatAverage}
          />
          <MetricLineChart
            title="Token usage by source"
            subtitle="Daily tokens by source service and operation."
            dateKeys={dateKeys}
            lines={buildOperationLines(operationBreakdown, operationSeries, dateKeys)}
            emptyMessage="No operation token usage recorded."
          />
        </div>
      )}
    </section>
  );
};
