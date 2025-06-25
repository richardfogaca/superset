/* eslint-disable no-param-reassign */
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  AnnotationData,
  AnnotationOpacity,
  AxisType,
  CategoricalColorScale,
  EventAnnotationLayer,
  FilterState,
  FormulaAnnotationLayer,
  IntervalAnnotationLayer,
  isPhysicalColumn,
  isTimeseriesAnnotationResult,
  LegendState,
  SupersetTheme,
  TimeseriesAnnotationLayer,
  TimeseriesDataRecord,
  ValueFormatter,
} from '@superset-ui/core';
import type {
  CallbackDataParams,
  DefaultStatesMixin,
  ItemStyleOption,
  LineStyleOption,
  OptionName,
  SeriesLabelOption,
  SeriesLineLabelOption,
  ZRLineType,
} from 'echarts/types/src/util/types';
import type { SeriesOption } from 'echarts';
import type {
  MarkArea1DDataItemOption,
  MarkArea2DDataItemOption,
} from 'echarts/types/src/component/marker/MarkAreaModel';
import type { MarkLine1DDataItemOption } from 'echarts/types/src/component/marker/MarkLineModel';
import { extractForecastSeriesContext } from '../utils/forecast';
import {
  DataType,
  EchartsTimeseriesSeriesType,
  ForecastSeriesEnum,
  LegendOrientation,
  OrientationType,
  ProcessTransformedSeriesProps,
  StackBarXAxisSecondLevelProps,
  StackBarYAxisSecondLevelProps,
  StackType,
  VerboseMapType,
} from '../types';

import {
  evalFormula,
  extractRecordAnnotations,
  formatAnnotationLabel,
  parseAnnotationOpacity,
} from '../utils/annotation';
import { getChartPadding, getTimeCompareStackId } from '../utils/series';
import {
  OpacityEnum,
  StackControlsValue,
  TIMESERIES_CONSTANTS,
} from '../constants';

// based on weighted wiggle algorithm
// source: https://ieeexplore.ieee.org/document/4658136
export const getBaselineSeriesForStream = (
  series: [string | number, number][][],
  seriesType: EchartsTimeseriesSeriesType,
) => {
  const seriesLength = series[0].length;
  const baselineSeriesDelta = new Array(seriesLength).fill([0, 0]);
  const getVal = (value: number | null) => value ?? 0;
  for (let i = 0; i < seriesLength; i += 1) {
    let seriesSum = 0;
    let weightedSeriesSum = 0;
    for (let j = 0; j < series.length; j += 1) {
      const delta =
        i > 0
          ? getVal(series[j][i][1]) - getVal(series[j][i - 1][1])
          : getVal(series[j][i][1]);
      let deltaPrev = 0;
      for (let k = 1; k < j - 1; k += 1) {
        deltaPrev +=
          i > 0
            ? getVal(series[k][i][1]) - getVal(series[k][i - 1][1])
            : getVal(series[k][i][1]);
      }
      weightedSeriesSum += (0.5 * delta + deltaPrev) * getVal(series[j][i][1]);
      seriesSum += getVal(series[j][i][1]);
    }
    baselineSeriesDelta[i] = [series[0][i][0], -weightedSeriesSum / seriesSum];
  }
  const baselineSeries = baselineSeriesDelta.reduce((acc, curr, i) => {
    if (i === 0) {
      acc.push(curr);
    } else {
      acc.push([curr[0], acc[i - 1][1] + curr[1]]);
    }
    return acc;
  }, []);
  return {
    data: baselineSeries,
    name: 'baseline',
    stack: 'obs',
    stackStrategy: 'all' as const,
    type: 'line' as const,
    lineStyle: {
      opacity: 0,
    },
    tooltip: {
      show: false,
    },
    silent: true,
    showSymbol: false,
    areaStyle: {
      opacity: 0,
    },
    step: [
      EchartsTimeseriesSeriesType.Start,
      EchartsTimeseriesSeriesType.Middle,
      EchartsTimeseriesSeriesType.End,
    ].includes(seriesType)
      ? (seriesType as
          | EchartsTimeseriesSeriesType.Start
          | EchartsTimeseriesSeriesType.Middle
          | EchartsTimeseriesSeriesType.End)
      : undefined,
    smooth: seriesType === EchartsTimeseriesSeriesType.Smooth,
  };
};

export function transformSeries(
  series: SeriesOption,
  colorScale: CategoricalColorScale,
  colorScaleKey: string,
  opts: {
    area?: boolean;
    connectNulls?: boolean;
    filterState?: FilterState;
    seriesContexts?: { [key: string]: ForecastSeriesEnum[] };
    markerEnabled?: boolean;
    markerSize?: number;
    areaOpacity?: number;
    seriesType?: EchartsTimeseriesSeriesType;
    stack?: StackType;
    stackIdSuffix?: string;
    yAxisIndex?: number;
    showValue?: boolean;
    onlyTotal?: boolean;
    legendState?: LegendState;
    formatter?: ValueFormatter;
    totalStackedValues?: number[];
    showValueIndexes?: number[];
    thresholdValues?: number[];
    richTooltip?: boolean;
    seriesKey?: OptionName;
    sliceId?: number;
    isHorizontal?: boolean;
    lineStyle?: LineStyleOption;
    queryIndex?: number;
    timeCompare?: string[];
    timeShiftColor?: boolean;
  },
): SeriesOption | undefined {
  const { name } = series;
  const {
    area,
    connectNulls,
    filterState,
    seriesContexts = {},
    markerEnabled,
    markerSize,
    areaOpacity = 1,
    seriesType,
    stack,
    stackIdSuffix,
    yAxisIndex = 0,
    showValue,
    onlyTotal,
    formatter,
    legendState,
    totalStackedValues = [],
    showValueIndexes = [],
    thresholdValues = [],
    richTooltip,
    seriesKey,
    sliceId,
    isHorizontal = false,
    queryIndex = 0,
    timeCompare = [],
    timeShiftColor,
  } = opts;
  const contexts = seriesContexts[name || ''] || [];
  const hasForecast =
    contexts.includes(ForecastSeriesEnum.ForecastTrend) ||
    contexts.includes(ForecastSeriesEnum.ForecastLower) ||
    contexts.includes(ForecastSeriesEnum.ForecastUpper);

  const forecastSeries = extractForecastSeriesContext(name || '');
  const isConfidenceBand =
    forecastSeries.type === ForecastSeriesEnum.ForecastLower ||
    forecastSeries.type === ForecastSeriesEnum.ForecastUpper;
  const isFiltered =
    filterState?.selectedValues && !filterState?.selectedValues.includes(name);
  const opacity = isFiltered
    ? OpacityEnum.SemiTransparent
    : opts.lineStyle?.opacity || OpacityEnum.NonTransparent;

  // don't create a series if doing a stack or area chart and the result
  // is a confidence band
  if ((stack || area) && isConfidenceBand) return undefined;

  const isObservation = forecastSeries.type === ForecastSeriesEnum.Observation;
  const isTrend = forecastSeries.type === ForecastSeriesEnum.ForecastTrend;
  let stackId;
  if (isConfidenceBand) {
    stackId = forecastSeries.name;
  } else if (stack && isObservation) {
    // the suffix of the observation series is '' (falsy), which disables
    // stacking. Therefore, we need to set something that is truthy.
    stackId = getTimeCompareStackId('obs', timeCompare, name);
  } else if (stack && isTrend) {
    stackId = getTimeCompareStackId(forecastSeries.type, timeCompare, name);
  }
  if (stackId && stackIdSuffix) {
    stackId += stackIdSuffix;
  }
  let plotType;
  if (
    !isConfidenceBand &&
    (seriesType === 'scatter' || (hasForecast && isObservation))
  ) {
    plotType = 'scatter';
  } else if (isConfidenceBand) {
    plotType = 'line';
  } else {
    plotType = seriesType === 'bar' ? 'bar' : 'line';
  }
  /**
   * if timeShiftColor is enabled the colorScaleKey forces the color to be the
   * same as the original series, otherwise uses separate colors
   * */
  const itemStyle: ItemStyleOption = {
    color: timeShiftColor
      ? colorScale(colorScaleKey, sliceId)
      : colorScale(seriesKey || forecastSeries.name, sliceId),
    opacity,
    borderWidth: 0,
  };
  if (seriesType === 'bar' && connectNulls) {
    itemStyle.borderWidth = 1.5;
    itemStyle.borderType = 'dotted';
    itemStyle.borderColor = itemStyle.color;
  }
  let emphasis = {};
  let showSymbol = false;
  if (!isConfidenceBand) {
    if (plotType === 'scatter') {
      showSymbol = true;
    } else if (hasForecast && isObservation) {
      showSymbol = true;
    } else if (plotType === 'line' && showValue) {
      showSymbol = true;
    } else if (plotType === 'line' && !richTooltip && !markerEnabled) {
      // this is hack to make timeseries line chart clickable when tooltip trigger is 'item'
      // so that the chart can emit cross-filtering
      showSymbol = true;
      itemStyle.opacity = 0;
      emphasis = {
        itemStyle: {
          opacity: 1,
        },
      };
    } else if (markerEnabled) {
      showSymbol = true;
    }
  }
  const lineStyle =
    isConfidenceBand || (stack === StackControlsValue.Stream && area)
      ? { ...opts.lineStyle, opacity: OpacityEnum.Transparent }
      : { ...opts.lineStyle, opacity };
  return {
    ...series,
    connectNulls,
    queryIndex,
    yAxisIndex,
    name: forecastSeries.name,
    itemStyle,
    // @ts-ignore
    type: plotType,
    smooth: seriesType === 'smooth',
    triggerLineEvent: true,
    // @ts-ignore
    step: ['start', 'middle', 'end'].includes(seriesType as string)
      ? seriesType
      : undefined,
    stack: stackId,
    stackStrategy:
      isConfidenceBand || stack === StackControlsValue.Stream
        ? 'all'
        : 'samesign',
    lineStyle,
    areaStyle:
      area || forecastSeries.type === ForecastSeriesEnum.ForecastUpper
        ? {
            opacity: opacity * areaOpacity,
          }
        : undefined,
    emphasis,
    showSymbol,
    symbolSize: markerSize,
    label: {
      show: !!showValue,
      position: isHorizontal ? 'right' : 'top',
      formatter: (params: any) => {
        // don't show confidence band value labels, as they're already visible on the tooltip
        if (
          [
            ForecastSeriesEnum.ForecastUpper,
            ForecastSeriesEnum.ForecastLower,
          ].includes(forecastSeries.type)
        ) {
          return '';
        }
        const { value, dataIndex, seriesIndex, seriesName } = params;
        const numericValue = isHorizontal ? value[0] : value[1];
        const isSelectedLegend = !legendState || legendState[seriesName];
        const isAreaExpand = stack === StackControlsValue.Expand;
        if (!formatter) {
          return numericValue;
        }
        if (!stack && isSelectedLegend) {
          return formatter(numericValue);
        }
        if (!onlyTotal) {
          if (
            numericValue >=
            (thresholdValues[dataIndex] || Number.MIN_SAFE_INTEGER)
          ) {
            return formatter(numericValue);
          }
          return '';
        }
        if (seriesIndex === showValueIndexes[dataIndex]) {
          return formatter(isAreaExpand ? 1 : totalStackedValues[dataIndex]);
        }
        return '';
      },
    },
  };
}

export function transformFormulaAnnotation(
  layer: FormulaAnnotationLayer,
  data: TimeseriesDataRecord[],
  xAxisCol: string,
  xAxisType: AxisType,
  colorScale: CategoricalColorScale,
  sliceId?: number,
  orientation?: OrientationType,
): SeriesOption {
  const { name, color, opacity, width, style } = layer;
  const isHorizontal = orientation === OrientationType.Horizontal;

  return {
    name,
    id: name,
    itemStyle: {
      color: color || colorScale(name, sliceId),
    },
    lineStyle: {
      opacity: parseAnnotationOpacity(opacity),
      type: style as ZRLineType,
      width,
    },
    type: 'line',
    smooth: true,
    data: evalFormula(layer, data, xAxisCol, xAxisType).map(([x, y]) =>
      isHorizontal ? [y, x] : [x, y],
    ),
    symbolSize: 0,
  };
}

export function transformIntervalAnnotation(
  layer: IntervalAnnotationLayer,
  data: TimeseriesDataRecord[],
  annotationData: AnnotationData,
  colorScale: CategoricalColorScale,
  theme: SupersetTheme,
  sliceId?: number,
  orientation?: OrientationType,
): SeriesOption[] {
  const series: SeriesOption[] = [];
  const annotations = extractRecordAnnotations(layer, annotationData);
  annotations.forEach(annotation => {
    const { name, color, opacity, showLabel } = layer;
    const { descriptions, intervalEnd, time, title } = annotation;
    const label = formatAnnotationLabel(name, title, descriptions);
    const isHorizontal = orientation === OrientationType.Horizontal;
    const intervalData: (
      | MarkArea1DDataItemOption
      | MarkArea2DDataItemOption
    )[] = [
      [
        {
          name: label,
          ...(isHorizontal ? { yAxis: time } : { xAxis: time }),
        },
        isHorizontal ? { yAxis: intervalEnd } : { xAxis: intervalEnd },
      ],
    ];
    const intervalLabel: SeriesLabelOption = showLabel
      ? {
          show: true,
          color: theme.colors.grayscale.dark2,
          position: 'insideTop',
          verticalAlign: 'top',
          fontWeight: 'bold',
          // @ts-ignore
          emphasis: {
            position: 'insideTop',
            verticalAlign: 'top',
            backgroundColor: theme.colors.grayscale.light5,
          },
        }
      : {
          show: false,
          color: theme.colors.grayscale.dark2,
          // @ts-ignore
          emphasis: {
            fontWeight: 'bold',
            show: true,
            position: 'insideTop',
            verticalAlign: 'top',
            backgroundColor: theme.colors.grayscale.light5,
          },
        };
    series.push({
      id: `Interval - ${label}`,
      type: 'line',
      animation: false,
      markArea: {
        silent: false,
        itemStyle: {
          color: color || colorScale(name, sliceId),
          opacity: parseAnnotationOpacity(opacity || AnnotationOpacity.Medium),
          emphasis: {
            opacity: 0.8,
          },
        } as ItemStyleOption,
        label: intervalLabel,
        data: intervalData,
      },
    });
  });
  return series;
}

export function transformEventAnnotation(
  layer: EventAnnotationLayer,
  data: TimeseriesDataRecord[],
  annotationData: AnnotationData,
  colorScale: CategoricalColorScale,
  theme: SupersetTheme,
  sliceId?: number,
  orientation?: OrientationType,
): SeriesOption[] {
  const series: SeriesOption[] = [];
  const annotations = extractRecordAnnotations(layer, annotationData);
  annotations.forEach(annotation => {
    const { name, color, opacity, style, width, showLabel } = layer;
    const { descriptions, time, title } = annotation;
    const label = formatAnnotationLabel(name, title, descriptions);
    const isHorizontal = orientation === OrientationType.Horizontal;
    const eventData: MarkLine1DDataItemOption[] = [
      {
        name: label,
        ...(isHorizontal ? { yAxis: time } : { xAxis: time }),
      },
    ];

    const lineStyle: LineStyleOption & DefaultStatesMixin['emphasis'] = {
      width,
      type: style as ZRLineType,
      color: color || colorScale(name, sliceId),
      opacity: parseAnnotationOpacity(opacity),
      emphasis: {
        width: width ? width + 1 : width,
        opacity: 1,
      },
    };

    const eventLabel: SeriesLineLabelOption = showLabel
      ? {
          show: true,
          color: theme.colors.grayscale.dark2,
          position: 'insideEndTop',
          fontWeight: 'bold',
          formatter: (params: CallbackDataParams) => params.name,
          // @ts-ignore
          emphasis: {
            backgroundColor: theme.colors.grayscale.light5,
          },
        }
      : {
          show: false,
          color: theme.colors.grayscale.dark2,
          position: 'insideEndTop',
          // @ts-ignore
          emphasis: {
            formatter: (params: CallbackDataParams) => params.name,
            fontWeight: 'bold',
            show: true,
            backgroundColor: theme.colors.grayscale.light5,
          },
        };

    series.push({
      id: `Event - ${label}`,
      type: 'line',
      animation: false,
      markLine: {
        silent: false,
        symbol: 'none',
        lineStyle,
        label: eventLabel,
        data: eventData,
      },
    });
  });
  return series;
}

export function transformTimeseriesAnnotation(
  layer: TimeseriesAnnotationLayer,
  markerSize: number,
  data: TimeseriesDataRecord[],
  annotationData: AnnotationData,
  colorScale: CategoricalColorScale,
  sliceId?: number,
  orientation?: OrientationType,
): SeriesOption[] {
  const series: SeriesOption[] = [];
  const { hideLine, name, opacity, showMarkers, style, width, color } = layer;
  const result = annotationData[name];
  const isHorizontal = orientation === OrientationType.Horizontal;
  if (isTimeseriesAnnotationResult(result)) {
    result.forEach(annotation => {
      const { key, values } = annotation;
      series.push({
        type: 'line',
        id: key,
        name: key,
        data: values.map(({ x, y }) =>
          isHorizontal
            ? ([y, x] as [number, OptionName])
            : ([x, y] as [OptionName, number]),
        ),
        symbolSize: showMarkers ? markerSize : 0,
        lineStyle: {
          opacity: parseAnnotationOpacity(opacity),
          type: style as ZRLineType,
          width: hideLine ? 0 : width,
          color: color || colorScale(name, sliceId),
        },
      });
    });
  }
  return series;
}

export function getPadding(
  showLegend: boolean,
  legendOrientation: LegendOrientation,
  addYAxisTitleOffset: boolean,
  zoomable: boolean,
  margin?: string | number | null,
  addXAxisTitleOffset?: boolean,
  yAxisTitlePosition?: string,
  yAxisTitleMargin?: number,
  xAxisTitleMargin?: number,
  isHorizontal?: boolean,
): {
  bottom: number;
  left: number;
  right: number;
  top: number;
} {
  const yAxisOffset = addYAxisTitleOffset
    ? TIMESERIES_CONSTANTS.yAxisLabelTopOffset
    : 0;
  const xAxisOffset = addXAxisTitleOffset ? Number(xAxisTitleMargin) || 0 : 0;

  return getChartPadding(
    showLegend,
    legendOrientation,
    margin,
    {
      top:
        yAxisTitlePosition && yAxisTitlePosition === 'Top'
          ? TIMESERIES_CONSTANTS.gridOffsetTop + (Number(yAxisTitleMargin) || 0)
          : TIMESERIES_CONSTANTS.gridOffsetTop + yAxisOffset,
      bottom:
        zoomable && !isHorizontal
          ? TIMESERIES_CONSTANTS.gridOffsetBottomZoomable + xAxisOffset
          : TIMESERIES_CONSTANTS.gridOffsetBottom + xAxisOffset,
      left:
        yAxisTitlePosition === 'Left'
          ? TIMESERIES_CONSTANTS.gridOffsetLeft +
            (Number(yAxisTitleMargin) || 0)
          : TIMESERIES_CONSTANTS.gridOffsetLeft,
      right:
        showLegend && legendOrientation === LegendOrientation.Right
          ? 0
          : TIMESERIES_CONSTANTS.gridOffsetRight,
    },
    isHorizontal,
  );
}

function processEntry(
  entry: { name: string | null; stack: string },
  legendData: string[],
  secondLevelXAxis: Set<string>,
  verboseMap: VerboseMapType,
) {
  if (entry.name !== null && entry.name !== undefined) {
    entry.name = verboseMap[entry.name] || entry.name;
    legendData.push(entry.name);
  }
  if (entry.stack && entry.stack !== 'obs') {
    secondLevelXAxis.add(entry.stack);
  }
}

function updateLengthXAxis(entry: { stack: string }, lengthXAxis: number) {
  const sizeAxis = entry.stack.length || 0;
  if (lengthXAxis < sizeAxis) {
    return sizeAxis;
  }
  return lengthXAxis;
}

function calculateRealLabelRotationAndOffset(
  xAxisLabelRotation: number,
  lengthXAxis: number,
) {
  let xRealLabelRotation = xAxisLabelRotation;
  if (xAxisLabelRotation < 40) {
    xRealLabelRotation = xAxisLabelRotation <= 5 ? 1.5 : xAxisLabelRotation - 5;
  }

  let offsetReal = lengthXAxis * Math.pow(xRealLabelRotation, 0.43);
  if (xAxisLabelRotation === 0.0) {
    offsetReal = 20;
  }

  return { xRealLabelRotation, offsetReal };
}

function updateXAxisOptions(
  echartOptions: any,
  xRealLabelRotation: number,
  offsetReal: number,
  secondLevelXAxis: Set<string>,
  xAxisCategories: Set<any>,
) {
  echartOptions.xAxis = [
    {
      ...echartOptions.xAxis,
      offset: offsetReal,
    },
    {
      position: 'bottom',
      axisLabel: {
        interval: 0,
        rotate: xRealLabelRotation,
        overflow: 'truncate',
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      data: Array.from({ length: xAxisCategories.size }, () => [
        ...secondLevelXAxis,
      ]).flat(),
    },
  ];
}

export function stackBarXAxisSecondLevel({
  seriesType,
  stack,
  echartOptions,
  verboseMap,
  xAxisOrig,
  data,
  xAxisLabelRotation,
}: StackBarXAxisSecondLevelProps) {
  if (seriesType === 'bar' && stack) {
    // eslint-disable-next-line no-param-reassign
    echartOptions.legend.data = [];
    const secondLevelXAxis = new Set<string>();
    let lengthXAxis = 0.0;
    // @ts-ignore
    echartOptions.series.forEach(entry => {
      processEntry(
        entry,
        echartOptions.legend.data,
        secondLevelXAxis,
        verboseMap,
      );
      if (entry.stack && entry.stack !== 'obs') {
        secondLevelXAxis.add(entry.stack);
        lengthXAxis = updateLengthXAxis(entry, lengthXAxis);
      }
    });
    if (secondLevelXAxis.size > 0) {
      const xAxisCategories = new Set();
      const xAxisPhy = isPhysicalColumn(xAxisOrig)
        ? xAxisOrig
        : xAxisOrig.label;
      data.forEach((entry: any) => {
        xAxisCategories.add(entry[xAxisPhy]);
      });
      // eslint-disable-next-line no-param-reassign
      delete echartOptions.xAxis.axisLabel.rotate;
      // eslint-disable-next-line no-param-reassign
      delete echartOptions.xAxis.axisLabel.width;
      const { xRealLabelRotation, offsetReal } =
        calculateRealLabelRotationAndOffset(
          Number(xAxisLabelRotation),
          lengthXAxis,
        );
      updateXAxisOptions(
        echartOptions,
        xRealLabelRotation,
        offsetReal,
        secondLevelXAxis,
        xAxisCategories,
      );
    }
  }
}

export const isNumeral = (str: string): boolean => /^\d+$/.test(str);

export function splitStack({
  transformedSeries,
  isHorizontal,
  onlyTotal,
  stack,
  groupby,
  legendNames,
  colorScale,
  sliceId,
  hasDoubleComma,
}: ProcessTransformedSeriesProps): boolean {
  const { label: default_label } = transformedSeries;

  if (onlyTotal) default_label.position = isHorizontal ? 'right' : 'top';
  let name: string = transformedSeries.name as string;
  if (stack) {
    const names = name?.split(',');
    if (groupby && groupby.length !== names.length - 1) {
      hasDoubleComma = true;
      console.warn(
        '[WARNING] There too much comma to ' +
          'differentiate the dimensions (or group by) and to ' +
          'make a multi-level BarChart.',
      );
    }
    // change of metric to label-name
    if (names.length > 1 && !hasDoubleComma) {
      name = names.at(0) ?? '';
      names[0] = name;
      transformedSeries.id = names.join(',');
      transformedSeries.name = name;
      legendNames.push(name); // fix missing legend names when hiding secondary label
      const dimensions = names.slice(1); // recovery dimension name
      transformedSeries.stack = dimensions.join(' -').trim();
      if (isNumeral(transformedSeries.stack)) {
        transformedSeries.stack = `${transformedSeries.stack} `;
      }
    }
  }
  return false;
}
