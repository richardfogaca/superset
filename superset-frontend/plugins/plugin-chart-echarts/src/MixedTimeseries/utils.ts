/* eslint-disable no-plusplus */
import { SeriesOption } from 'echarts';
import { ECBasicOption, OptionId } from 'echarts/types/src/util/types';
import DataItem, {
  LegendOption,
} from 'echarts/types/src/component/legend/LegendModel';
import { isArray } from 'lodash';
import {
  ChartOptions,
  CreateTooltipFormatterProps,
  DataZoom,
  EchartOptions,
  ModifyBarSeriesReturn,
  ModifyScatterSeriesReturn,
  SeriesItem,
  SeriesOptionType,
  XAxisItem,
  YAxisItem,
} from '../types';
import {
  extractForecastValuesFromTooltipParams,
  formatForecastTooltipSeries,
} from '../utils/forecast';
import {
  MIXED_CHART_QUERY_B_SUFFIX,
  Y_AXIS_NUMBER_OF_TICKS,
  Y_AXIS_PADDING_MULTIPLIER,
} from '../constants';

export const BAR_WIDTH_CONTANTS = {
  widthMultiplier: 0.6,
  defaultWidth: 20,
  defaultGap: '20%',
  maxBarWidth: 50,
};

function calculateStackMinMax(series: SeriesItem[]) {
  const stackedValues: {
    [key: string | number]: { positive: number; negative: number };
  } = {};

  // Accumulate positive and negative values for each key
  series
    .filter(item => item.stack !== undefined && item.data)
    .forEach(item => {
      item.data.forEach(dataItem => {
        if (typeof dataItem[1] === 'number') {
          const key = dataItem[0];
          const value = dataItem[1];

          if (!stackedValues[key]) {
            stackedValues[key] = { positive: 0, negative: 0 };
          }

          if (value >= 0) {
            stackedValues[key].positive += value;
          } else {
            stackedValues[key].negative += value;
          }
        }
      });
    });

  // Find the maximum absolute total among all keys
  let maxAbsoluteTotal = 0;
  Object.values(stackedValues).forEach(({ positive, negative }) => {
    const currentMax = Math.max(positive, Math.abs(negative));
    if (currentMax > maxAbsoluteTotal) {
      maxAbsoluteTotal = currentMax;
    }
  });

  if (maxAbsoluteTotal === 0) {
    return null;
  }

  maxAbsoluteTotal *= Y_AXIS_PADDING_MULTIPLIER;
  const min = -maxAbsoluteTotal;
  const max = maxAbsoluteTotal;

  return { min, max };
}

function hasOppositeValues(indexes: Record<number, number[]>) {
  const indexValues = Object.values(indexes);
  const onlyOneYAxis = indexValues.length === 1;

  if (onlyOneYAxis) {
    return false;
  }

  const notApplicableListFormat =
    indexValues.length !== 2 ||
    !indexValues[0].length ||
    !indexValues[1].length;

  if (notApplicableListFormat) {
    return false;
  }

  const hasNegativeValuesOnSeriesA = indexValues[0].some(value => value < 0);
  const hasPositiveValuesOnSeriesA = indexValues[0].some(value => value > 0);
  const hasNegativeValuesOnSeriesB = indexValues[1].some(value => value < 0);
  const hasPositiveValuesOnSeriesB = indexValues[1].some(value => value > 0);

  return (
    (hasNegativeValuesOnSeriesA && hasPositiveValuesOnSeriesB) ||
    (hasPositiveValuesOnSeriesA && hasNegativeValuesOnSeriesB)
  );
}

function getSeriesYAxisIndexes(series: SeriesItem[]): number[] {
  const uniqueIndexes = new Set<number>();

  series.forEach(item => {
    if (item.yAxisIndex !== undefined) {
      uniqueIndexes.add(item.yAxisIndex);
    }
  });

  return Array.from(uniqueIndexes);
}

const isNumber = (value: any): value is number => typeof value === 'number';

export function getOnZeroAxisIndex(series: SeriesItem[]) {
  const yAxisIndexes = getSeriesYAxisIndexes(series);
  if (isArray(yAxisIndexes)) {
    return yAxisIndexes[0];
  }
  return yAxisIndexes;
}

export function dedupIds(
  seriesAIds: (OptionId | undefined)[],
  seriesBIds: (OptionId | undefined)[],
) {
  const modifiedSeriesBIds = seriesBIds.map(item =>
    seriesAIds.includes(item) ? `${item} (1)` : item,
  );
  return [seriesAIds, modifiedSeriesBIds];
}

export function createTooltipFormatter({
  rawSeriesAIds,
  rawSeriesBIds,
  richTooltip,
  tooltipSortByMetric,
  tooltipFormatter,
  tooltipSuffix,
  tooltipSuffixB,
  primarySeries,
  formatter,
  formatterSecondary,
  getFormatter,
  customFormatters,
  customFormattersSecondary,
  groupby,
  groupbyB,
  inverted,
  labelMap,
  labelMapB,
  metrics,
  metricsB,
  contributionMode,
  focusedSeries,
}: CreateTooltipFormatterProps) {
  const [seriesAIds, seriesBIds] = dedupIds(rawSeriesAIds, rawSeriesBIds);
  return (params: any) => {
    const xValue: number = richTooltip ? params[0].value[0] : params.value[0];
    const forecastValue: any[] = richTooltip ? params : [params];

    if (richTooltip && tooltipSortByMetric) {
      forecastValue.sort((a, b) => b.data[1] - a.data[1]);
    }

    const rows: Array<string> = [`${tooltipFormatter(xValue)}`];
    const forecastValues =
      extractForecastValuesFromTooltipParams(forecastValue);

    Object.keys(forecastValues).forEach(key => {
      const value = forecastValues[key];
      let updatedKey;
      // if there are no dimensions, key is a verbose name of a metric,
      // otherwise it is a comma separated string where the first part is metric name
      let formatterKey;

      if (primarySeries.has(key)) {
        formatterKey =
          groupby.length === 0 ? inverted[key] : labelMap[key]?.[0];
      } else {
        formatterKey =
          groupbyB.length === 0 ? inverted[key] : labelMapB[key]?.[0];
      }
      const tooltipFormatter = getFormatter(
        customFormatters,
        formatter,
        metrics,
        formatterKey,
        !!contributionMode,
      );
      const tooltipFormatterSecondary = getFormatter(
        customFormattersSecondary,
        formatterSecondary,
        metricsB,
        formatterKey,
        !!contributionMode,
      );
      // If there's tooltipSuffix in seriesA or seriesB, append to the key
      if (seriesBIds.includes(key)) {
        if (key.includes(MIXED_CHART_QUERY_B_SUFFIX)) {
          updatedKey = tooltipSuffixB
            ? key.replace(MIXED_CHART_QUERY_B_SUFFIX, `(${tooltipSuffixB})`)
            : key;
        } else {
          updatedKey = tooltipSuffixB ? `${key} (${tooltipSuffixB})` : key;
        }
      } else if (seriesAIds.includes(key)) {
        updatedKey = tooltipSuffix ? `${key} (${tooltipSuffix})` : key;
      } else {
        updatedKey = key;
      }
      const content = formatForecastTooltipSeries({
        ...value,
        seriesName: updatedKey,
        formatter: primarySeries.has(key)
          ? tooltipFormatter
          : tooltipFormatterSecondary,
      });
      const contentStyle =
        key === focusedSeries ? 'font-weight: 700' : 'opacity: 0.7';
      rows.push(`<span style="${contentStyle}">${content}</span>`);
    });
    return rows.join('<br />');
  };
}

function getDuplicateItemBorderColor(
  type: string,
  changeScatterPlotColor: boolean,
  serieItem: SeriesOptionType,
  originalSerieItem: SeriesOptionType,
): string | undefined {
  if (type === 'bar') return undefined;
  if (type === 'scatter' && changeScatterPlotColor) {
    return originalSerieItem.itemStyle.color;
  }
  return serieItem.itemStyle.borderColor;
}

function getDuplicateItemBorderWidth(
  type: string,
  changeScatterPlotColor: boolean,
  serieItem: SeriesOptionType,
): number | undefined {
  if (type === 'bar') return undefined;
  if (type === 'scatter' && changeScatterPlotColor) return 2;
  return serieItem.itemStyle?.borderWidth ?? 2;
}

function getDuplicateItemColor(
  type: string,
  changeScatterPlotColor: boolean,
  serieItem: SeriesOptionType,
) {
  if (type === 'bar' && changeScatterPlotColor) {
    return serieItem.itemStyle.borderColor;
  }
  if (type === 'scatter' && changeScatterPlotColor) {
    return '#FFFFFF';
  }
  return serieItem.itemStyle.color;
}

function createNullValueDuplicate({
  id,
  originalSerie,
  markerSize,
  changeScatterPlotColor = false,
}: {
  id: string;
  originalSerie: SeriesOptionType;
  markerSize?: number;
  changeScatterPlotColor: boolean;
}) {
  const serie = JSON.parse(JSON.stringify(originalSerie));
  const type = originalSerie.type === 'scatter' ? 'bar' : 'scatter';
  const color = getDuplicateItemColor(type, changeScatterPlotColor, serie);
  const borderWidth = getDuplicateItemBorderWidth(
    type,
    changeScatterPlotColor,
    serie,
  );
  const borderColor = getDuplicateItemBorderColor(
    type,
    changeScatterPlotColor,
    serie,
    originalSerie,
  );
  const duplicateSerie = {
    ...serie,
    id,
    queryIndex: originalSerie.queryIndex ^ 1,
    origin: originalSerie.origin === 'A' ? 'B' : 'A',
    type,
    itemStyle: {
      ...serie.itemStyle,
      color,
      borderWidth,
      borderColor,
    },
  };
  if (markerSize) {
    duplicateSerie.symbolSize = markerSize;
  }
  return duplicateSerie;
}

function normalizeId(id: string) {
  return id.replace(/\s\(1\)$/, '');
}

const findPairIndex = (item: SeriesOptionType, list: SeriesOptionType[]) => {
  const baseId = item.id.replace(' (1)', '');
  for (let i = 0; i < list.length; i++) {
    if (normalizeId(list[i].id) === baseId) {
      return i;
    }
  }
  return -1;
};

function createDuplicateSerieItem(
  series: SeriesOptionType[],
  changeScatterPlotColor = false,
  markerSize?: number,
  markerSizeB?: number,
): SeriesOption[] {
  const listA: SeriesOptionType[] = [];
  const listB: SeriesOptionType[] = [];

  // Define which items belong to series A and B
  series.forEach(serie => {
    if (serie.origin === 'A') {
      listA.push(serie);
    } else {
      listB.push(serie);
    }
  });
  const listAType = listA[0]?.type;

  if (listAType === 'bar') {
    const insertionsB = [];
    // Go through listA items first, to check if there are series items (scatter) with no pair in listB.
    for (let i = 0; i < listA.length; i++) {
      const pairIndex = findPairIndex(listA[i], listB);
      if (pairIndex === -1) {
        const duplicate = createNullValueDuplicate({
          id: `${listA[i].id} (1)`,
          originalSerie: listA[i],
          markerSize: markerSizeB,
          changeScatterPlotColor,
        });
        insertionsB.push({ index: i, element: duplicate });
      } else {
        // The element exists, so need to ensure the same order on list B
        // 1. Remove the found element from its current position
        const [element] = listB.splice(pairIndex, 1);
        // 2. Insert the element in the same position as listA
        insertionsB.push({ index: i, element });
      }
    }
    insertionsB.forEach(({ index, element }) => {
      listA.splice(index, 0, element);
    });

    // Go through listB to check if there are series items (scatter) with no pair in listA.
    // If there are, append to the end of listA (new bars)
    for (let i = 0; i < listB.length; i++) {
      const pairIndex = findPairIndex(listB[i], listA);
      if (pairIndex === -1) {
        const duplicate = createNullValueDuplicate({
          id: `${listB[i].id} (1)`,
          originalSerie: listB[i],
          markerSize,
          changeScatterPlotColor,
        });
        listA.push(duplicate);
      }
    }
    return [...listA, ...listB] as SeriesOption[];
  }
  // listA type is scatter, listB is bar
  const insertionsA = [];
  for (let i = 0; i < listB.length; i++) {
    const pairIndex = findPairIndex(listB[i], listA);
    if (pairIndex === -1) {
      const duplicate = createNullValueDuplicate({
        id: `${listB[i].id} (1)`,
        originalSerie: listB[i],
        markerSize,
        changeScatterPlotColor,
      });
      insertionsA.push({ index: i, element: duplicate });
    } else {
      // The element exists, so need to ensure the same order on list A
      // 1. Remove the found element from its current position
      const [element] = listA.splice(pairIndex, 1);
      // 2. Insert the element in the same position as listB
      insertionsA.push({ index: i, element });
    }
  }
  insertionsA.forEach(({ index, element }) => {
    listA.splice(index, 0, element);
  });

  // Go through listA to check if there are series items (scatter) with no pair in listB.
  // If there are, append to the end of listB (new bars)
  for (let i = 0; i < listA.length; i++) {
    const pairIndex = findPairIndex(listA[i], listB);
    if (pairIndex === -1) {
      const duplicate = createNullValueDuplicate({
        id: `${listA[i].id} (1)`,
        originalSerie: listA[i],
        markerSize: markerSizeB,
        changeScatterPlotColor,
      });
      listB.push(duplicate);
    }
  }

  return [...listA, ...listB] as SeriesOption[];
}

function calculateScatterOffset(
  barsTotal: number,
  barWidth: number,
  barGap = BAR_WIDTH_CONTANTS.defaultGap,
): number[][] {
  const offsets = [];
  const barGapNumber = parseFloat(barGap) / 100;
  const totalGap =
    (barsTotal - 1) * (barWidth * barGapNumber) + barsTotal * barWidth;
  const initialOffset = -totalGap / 2 + barWidth / 2;

  for (let i = 0; i < barsTotal; i++) {
    const offset = initialOffset + i * (barWidth + barGapNumber * barWidth);
    offsets.push([offset, 0]);
  }
  return offsets;
}

function modifyScatterSeries(
  row: SeriesOption,
  barsTotal: number,
  scatterIndex: number,
  barWidth = BAR_WIDTH_CONTANTS.defaultWidth,
  barGap = BAR_WIDTH_CONTANTS.defaultGap,
): ModifyScatterSeriesReturn {
  const scatterOffset = calculateScatterOffset(barsTotal, barWidth, barGap);
  // @ts-ignore
  return {
    ...row,
    symbolOffset: scatterOffset[scatterIndex - 1],
  };
}

function getTotalBarsInChart(
  series: SeriesOption[],
  dataZoom: { start: number; end: number }[],
  barCategoriesTotal: number,
) {
  const rowData = series ? (series[0].data as number[]) : [];
  const rowDataLength = rowData ? rowData.length : 0;

  const zoom = dataZoom?.[0];
  const zoomStart = zoom?.start ?? 0;
  const zoomEnd = zoom?.end ?? 100;

  const zoomStep = 100 / rowDataLength / 2;
  const zoomStartIndex = Math.round(zoomStart / zoomStep / 2);
  const zoomEndIndex = Math.round(zoomEnd / zoomStep / 2);
  const zoomItemQuantity = zoomEndIndex - zoomStartIndex + 1;

  const totalBarsInChart = zoomItemQuantity * barCategoriesTotal;
  return totalBarsInChart;
}

function modifyBarSeries(
  row: SeriesOption,
  barWidth = BAR_WIDTH_CONTANTS.defaultWidth,
  barGap = BAR_WIDTH_CONTANTS.defaultGap,
): ModifyBarSeriesReturn {
  return {
    ...row,
    barWidth,
    barGap,
  };
}

function getBarsWidth(
  series: SeriesOption[],
  barsCategoriesTotal: number,
  dataZoom: { start: number; end: number }[],
  width: number,
) {
  const totalBarsInChart = getTotalBarsInChart(
    series,
    dataZoom,
    barsCategoriesTotal,
  );
  const barWidth =
    (width / totalBarsInChart) * BAR_WIDTH_CONTANTS.widthMultiplier;

  return Math.min(barWidth, BAR_WIDTH_CONTANTS.maxBarWidth);
}

function getSelectedLegends(legend: LegendOption) {
  const selectedLegends =
    legend?.data?.filter(
      (key: string | DataItem) =>
        !legend.selected || legend.selected[key as string] !== false,
    ) || [];
  return [...new Set(selectedLegends)];
}

function getSeriesYAxisValues(series: SeriesItem[]) {
  const indexes: Record<number, number[]> = {};
  series.forEach(item => {
    if (item.yAxisIndex === undefined || !item.data) return;

    const index = item.yAxisIndex;
    if (!indexes[index]) {
      indexes[index] = [];
    }
    item.data.forEach(dataItem => {
      indexes[index].push(dataItem[1]);
    });
  });
  return indexes;
}

function calculateUnstackedMinMax(series: SeriesItem[]) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  series
    .filter(item => item.stack === undefined && item.data)
    .forEach(item => {
      item.data.forEach(dataItem => {
        if (typeof dataItem[1] === 'number') {
          const value = Math.abs(dataItem[1]) * Y_AXIS_PADDING_MULTIPLIER;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });
  if (min === Number.POSITIVE_INFINITY && max === Number.NEGATIVE_INFINITY) {
    return null;
  }
  return { min: -max, max };
}

function updateYAxesIndividually(
  series: SeriesItem[],
  yAxis: YAxisItem[],
  seriesTypes: ('stacked' | 'unstacked')[],
): YAxisItem[] {
  let updatedYAxis = [...yAxis];
  [0, 1].forEach(index => {
    const isStacked = seriesTypes[index] === 'stacked';
    const relevantSeries = filterSeries(series, index, isStacked);
    const minMax = isStacked
      ? calculateStackMinMax(relevantSeries)
      : calculateUnstackedMinMax(relevantSeries);
    updatedYAxis = updateYAxisItem(updatedYAxis, index, minMax);
  });
  return updatedYAxis;
}

function createYAxisFormatter(
  existingFormatter: ((value: number) => string) | undefined,
) {
  return (value: number) => {
    if (Math.abs(value) < 1e-6) {
      return '0';
    }
    if (typeof existingFormatter === 'function') {
      return existingFormatter(value);
    }
    return value.toFixed(1);
  };
}

function calculateInterval(min: number, max: number, numberOfTicks: number) {
  const range = max - min;
  return range / numberOfTicks;
}

const updateYAxisItem = (
  yAxisItems: YAxisItem[],
  indexToUpdate: number,
  minMaxValues: { min: number; max: number } | null,
): YAxisItem[] => {
  if (!minMaxValues) return yAxisItems;

  const existingAxisItem = yAxisItems[indexToUpdate];
  const existingFormatter = existingAxisItem?.axisLabel?.formatter as (
    value: number,
  ) => string;
  const { min, max } = minMaxValues;

  const updatedAxisItem = {
    ...existingAxisItem,
    min,
    max,
    interval: calculateInterval(min, max, Y_AXIS_NUMBER_OF_TICKS),
    alignTicks: false,
    splitLine: { show: true },
    axisLabel: {
      ...existingAxisItem?.axisLabel,
      formatter: createYAxisFormatter(existingFormatter),
    },
  };

  const updatedYAxisItems = [...yAxisItems];
  updatedYAxisItems[indexToUpdate] = updatedAxisItem;
  return updatedYAxisItems;
};

function filterSeries(
  series: SeriesItem[],
  yAxisIndex: number,
  stacked: boolean,
) {
  return series.filter(
    (item: SeriesItem) =>
      (item.stack !== undefined) === stacked && item.yAxisIndex === yAxisIndex,
  );
}

function determineSeriesType(
  series: SeriesItem[],
  index: number,
): 'stacked' | 'unstacked' {
  return filterSeries(series, index, true).length > 0 ? 'stacked' : 'unstacked';
}

export function formatYAxis(
  echartOptions: EchartOptions | ECBasicOption,
): YAxisItem[] {
  const series = echartOptions.series as SeriesItem[];
  const yAxis =
    'yAxis' in echartOptions ? (echartOptions.yAxis as YAxisItem[]) : [];
  let yAxisFormatted = [...yAxis];

  // Early return if there is only one yAxis
  if (yAxis.length === 1) {
    return yAxisFormatted;
  }

  const seriesTypes = [0, 1].map(index => determineSeriesType(series, index));

  // Handle case when both queryA and queryB are stacked
  if (seriesTypes.every(type => type === 'stacked')) {
    const combinedSeries = [0, 1].flatMap(index =>
      filterSeries(series, index, true),
    );
    const minMax = calculateStackMinMax(combinedSeries);
    yAxisFormatted = updateYAxisItem(yAxisFormatted, 1, minMax);
  } else {
    yAxisFormatted = updateYAxesIndividually(
      series,
      yAxisFormatted,
      seriesTypes,
    );
  }

  return yAxisFormatted;
}

export function shouldRecalculateYAxis(series: SeriesItem[]) {
  const values = getSeriesYAxisValues(series);

  if (hasOppositeValues(values)) {
    return true;
  }
  return false;
}

export function shouldParseSeriesScatterPlots(
  options: ChartOptions | ECBasicOption,
) {
  const isTypeBar = (options.series as SeriesOption[]).some(
    serie => serie.type === 'bar',
  );
  const isTypeScatter = (options.series as SeriesOption[]).some(
    serie => serie.type === 'scatter',
  );
  const legendOption = options.legend as LegendOption[] | LegendOption;
  const legends = Array.isArray(legendOption) ? legendOption[0] : legendOption;
  const hasRepeatedElements =
    new Set(legends.data).size !== (legends.data?.length ?? 0);
  return isTypeBar && isTypeScatter && hasRepeatedElements;
}

export function formatSeriesScatterPlots(
  options: ChartOptions | ECBasicOption,
  width: number,
  changeScatterPlotColor = false,
  markerSize?: number,
  markerSizeB?: number,
): SeriesOption[] {
  if (!options.series || !options.legend) return [];
  const legendOption = options.legend as LegendOption[] | LegendOption;
  const legends = Array.isArray(legendOption) ? legendOption[0] : legendOption;
  const duplicateSeries = createDuplicateSerieItem(
    options.series as SeriesOptionType[],
    changeScatterPlotColor,
    markerSize,
    markerSizeB,
  );
  const customSeries = (options.series as SeriesOption[]).filter(
    serie => serie.type === 'custom',
  );
  const series = [...customSeries, ...duplicateSeries] as SeriesOption[];
  series.forEach(serie => {
    if (
      serie.name &&
      legends.data &&
      !legends.data.includes(String(serie.name))
    ) {
      legends.data.push(String(serie.name));
    }
  });
  const selectedLegends = getSelectedLegends(legends);
  const filteredSeries = series.filter(
    serie => serie.name && selectedLegends.includes(serie.name.toString()),
  );
  const barCategoriesTotal = filteredSeries.length / 2;
  const barsWidth = getBarsWidth(
    filteredSeries,
    barCategoriesTotal,
    (options.dataZoom || []) as DataZoom[],
    width,
  );
  let scatterIndex = 0;

  const seriesUpdated = (filteredSeries || []).map((row: SeriesOption) => {
    if (row.type === 'bar') {
      return modifyBarSeries(row, barsWidth);
    }
    if (
      row.type === 'scatter' &&
      row.name !== undefined &&
      selectedLegends.includes(row.name.toString())
    ) {
      scatterIndex += 1;
      return modifyScatterSeries(
        row,
        barCategoriesTotal,
        scatterIndex,
        barsWidth,
      );
    }
    return row;
  });
  // @ts-ignore
  return seriesUpdated;
}

export function formatOptions({
  echartOptions,
  width,
  changeScatterPlotColor,
  markerSize,
  markerSizeB,
  stack,
  stackB,
  yAxisIndex,
  yAxisIndexB,
  xAxisMinInterval,
}: any) {
  const applyPlotFix = shouldParseSeriesScatterPlots(echartOptions as any);
  const applyYIndexFix = shouldRecalculateYAxis(
    echartOptions.series as SeriesItem[],
  );
  const series = applyPlotFix
    ? formatSeriesScatterPlots(
        echartOptions as any,
        width,
        changeScatterPlotColor,
        markerSize,
        markerSizeB,
      )
    : (echartOptions.series as SeriesOption[]);
  const applyYAxisIndexFix = stack && stackB;
  const seriesFormatted = applyYAxisIndexFix
    ? series.map(item => ({
        ...item,
        yAxisIndex: yAxisIndex ?? yAxisIndexB,
      }))
    : series;
  const xMinInterval =
    xAxisMinInterval && isNumber(parseFloat(xAxisMinInterval))
      ? parseFloat(xAxisMinInterval)
      : undefined;

  return {
    ...echartOptions,
    yAxis: applyYIndexFix ? formatYAxis(echartOptions) : echartOptions.yAxis,
    xAxis: applyYIndexFix
      ? {
          ...(echartOptions.xAxis as XAxisItem),
          axisLine: {
            onZeroAxisIndex: getOnZeroAxisIndex(
              echartOptions.series as SeriesItem[],
            ),
          },
          minInterval: xMinInterval,
        }
      : {
          ...(echartOptions.xAxis as XAxisItem),
          minInterval: xMinInterval,
        },
    series: seriesFormatted,
  };
}
