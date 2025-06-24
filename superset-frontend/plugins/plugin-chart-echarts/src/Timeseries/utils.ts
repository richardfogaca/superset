export function sortLegendData({
  legendNames,
  annotationLabels,
  rawSeries,
  annotationLabelsFirst,
  legendSort,
  extractForecastSeriesContext,
  ForecastSeriesEnum,
}: {
  legendNames: string[];
  annotationLabels: string[];
  rawSeries: any[];
  annotationLabelsFirst: boolean;
  legendSort: string;
  extractForecastSeriesContext: (name: string) => any;
  ForecastSeriesEnum: any;
}): string[] {
  const observationSeriesNames = rawSeries
    .filter(entry => {
      const context = extractForecastSeriesContext(entry.name || '');
      return context.type === ForecastSeriesEnum.Observation;
    })
    .map(entry => entry.name || '');

  const chartData =
    legendNames.length > 0 ? legendNames : observationSeriesNames;

  let legendData = annotationLabelsFirst
    ? [...annotationLabels, ...chartData]
    : [...chartData, ...annotationLabels];

  const annotationItems = legendData.filter(item =>
    annotationLabels.includes(item),
  );
  const otherData = legendData.filter(item => !annotationLabels.includes(item));

  otherData.sort((a, b) => {
    if (legendSort === 'asc') {
      return String(a).localeCompare(String(b));
    }
    return String(b).localeCompare(String(a));
  });

  legendData = annotationLabelsFirst
    ? [...annotationItems, ...otherData]
    : [...otherData, ...annotationItems];

  return legendData;
}
