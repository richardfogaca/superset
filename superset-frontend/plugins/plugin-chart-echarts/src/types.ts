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
import { RefObject, Ref } from 'react';

import {
  ChartDataResponseResult,
  ChartProps,
  ContextMenuFilters,
  FilterState,
  HandlerFunction,
  LegendState,
  PlainObject,
  QueryFormColumn,
  SetDataMaskHook,
  ChartPlugin,
  SqlaFormData,
  ChartMetadata,
  CurrencyFormatter,
  NumberFormatter,
  ValueFormatter,
  QueryFormMetric,
  ContributionType,
} from '@superset-ui/core';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import type { TooltipMarker } from 'echarts/types/src/util/format';
import type { OptionId, SeriesOption } from 'echarts/types/src/util/types';
import { StackControlsValue } from './constants';

export type CreateTooltipFormatterProps = {
  rawSeriesAIds: (OptionId | undefined)[];
  rawSeriesBIds: (OptionId | undefined)[];
  richTooltip: boolean;
  tooltipSortByMetric: boolean;
  tooltipFormatter: (value: number) => string;
  tooltipSuffix: string;
  tooltipSuffixB: string;
  primarySeries: Set<string>;
  formatter: NumberFormatter | CurrencyFormatter;
  formatterSecondary: NumberFormatter | CurrencyFormatter;
  getFormatter: (
    customFormatters: Record<string, ValueFormatter>,
    defaultFormatter: ValueFormatter,
    metrics: QueryFormMetric[],
    formatterKey: string,
    forcePercentFormat: boolean,
  ) => ValueFormatter;
  customFormatters: {};
  customFormattersSecondary: {};
  groupby: QueryFormColumn[];
  groupbyB: QueryFormColumn[];
  inverted: Record<string, any>;
  labelMap: Record<string, string[]>;
  labelMapB: Record<string, string[]>;
  metrics: QueryFormMetric[];
  metricsB: QueryFormMetric[];
  contributionMode?: ContributionType;
  focusedSeries: string | null;
};

export type EchartsStylesProps = {
  height: number;
  width: number;
};

export type Refs = {
  echartRef?: Ref<EchartsHandler>;
  divRef?: RefObject<HTMLDivElement>;
};

export interface EchartsProps {
  height: number;
  width: number;
  echartOptions: EChartsCoreOption;
  eventHandlers?: EventHandlers;
  zrEventHandlers?: EventHandlers;
  selectedValues?: Record<number, string>;
  forceClear?: boolean;
  refs: Refs;
}

export interface EchartsHandler {
  getEchartInstance: () => EChartsType | undefined;
}

export enum ForecastSeriesEnum {
  Observation = '',
  ForecastTrend = '__yhat',
  ForecastUpper = '__yhat_upper',
  ForecastLower = '__yhat_lower',
}

export type ForecastSeriesContext = {
  name: string;
  type: ForecastSeriesEnum;
};

export enum LegendOrientation {
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right',
}

export enum LegendType {
  Scroll = 'scroll',
  Plain = 'plain',
}

export type ForecastValue = {
  marker: TooltipMarker;
  observation?: number;
  forecastTrend?: number;
  forecastLower?: number;
  forecastUpper?: number;
};

export type LegendFormData = {
  legendMargin: number | null | string;
  legendOrientation: LegendOrientation;
  legendType: LegendType;
  showLegend: boolean;
};

export type EventHandlers = Record<string, { (props: any): void }>;

export enum LabelPositionEnum {
  Top = 'top',
  Left = 'left',
  Right = 'right',
  Bottom = 'bottom',
  Inside = 'inside',
  InsideLeft = 'insideLeft',
  InsideRight = 'insideRight',
  InsideTop = 'insideTop',
  InsideBottom = 'insideBottom',
  InsideTopLeft = 'insideTopLeft',
  InsideBottomLeft = 'insideBottomLeft',
  InsideTopRight = 'insideTopRight',
  InsideBottomRight = 'insideBottomRight',
}

export interface BaseChartProps<T extends PlainObject> extends ChartProps<T> {
  queriesData: ChartDataResponseResult[];
}

export interface BaseTransformedProps<F> {
  echartOptions: EChartsCoreOption;
  formData: F;
  height: number;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  setDataMask?: SetDataMaskHook;
  onLegendStateChanged?: (state: LegendState) => void;
  filterState?: FilterState;
  refs: Refs;
  width: number;
  emitCrossFilters?: boolean;
  coltypeMapping?: Record<string, number>;
}

export type CrossFilterTransformedProps = {
  groupby: QueryFormColumn[];
  labelMap: Record<string, string[]>;
  setControlValue?: HandlerFunction;
  setDataMask: SetDataMaskHook;
  selectedValues: Record<number, string>;
  emitCrossFilters?: boolean;
};

export type ContextMenuTransformedProps = {
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  setDataMask?: SetDataMaskHook;
};

export interface TitleFormData {
  xAxisTitle: string;
  xAxisTitleMargin: number;
  yAxisTitle: string;
  yAxisTitleMargin: number;
  yAxisTitlePosition: string;
}

export type StackType = boolean | null | Partial<StackControlsValue>;

export interface TreePathInfo {
  name: string;
  dataIndex: number;
  value: number | number[];
}

export class EchartsChartPlugin<
  T extends SqlaFormData = SqlaFormData,
  P extends ChartProps = ChartProps,
> extends ChartPlugin<T, P> {
  constructor(props: any) {
    const { metadata, ...restProps } = props;
    super({
      ...restProps,
      metadata: new ChartMetadata({
        parseMethod: 'json-bigint',
        ...metadata,
      }),
    });
  }
}

export * from './Timeseries/types';

export type SeriesOptionType = SeriesOption & {
  itemStyle: {
    color: string;
    borderWidth?: number;
    borderColor?: string;
  };
  label?: {
    formatter?: (params: any) => string;
  };
  connectNulls?: boolean;
  origin?: string;
  queryIndex: number;
  id: string;
};

export type DataZoom = { start: number; end: number };
export type DataItem = [string, number];

export type SeriesItem = {
  data: DataItem[];
  yAxisIndex: number;
  stack?: string;
  type?: string;
};

export type YAxisItem = {
  scale: boolean;
  type: string;
  min?: number;
  max?: number;
  minorTick: {
    show: boolean;
  };
  minorSplitLine?: {
    show: false;
  };
  splitLine?: {
    show: boolean;
  };
  axisLabel: {
    formatter?: (value: number) => string;
  };
  nameGap?: number;
  nameLocation?: string;
  alignTicks: boolean;
};

export type XAxisItem = {
  axisLine: {
    onZeroAxisIndex?: number;
  };
};

export interface EchartOptions extends EChartsType {
  series: SeriesItem[];
  yAxis: YAxisItem[];
  xAxis: XAxisItem;
}

export interface ChartOptions extends EChartsType {
  dataZoom?: DataZoom[];
  series: SeriesOptionType[];
  legend?: any;
}

export interface ModifyBarSeriesReturn {
  SeriesOption?: SeriesOptionType[];
  barWidth: number;
  barGap: string;
}

export type ModifyScatterSeriesReturn = SeriesOptionType & {
  symbolOffset: number[];
};
