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

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  getTimeFormatter,
  getTimeFormatterForGranularity,
  SMART_DATE_ID,
  TimeGranularity,
} from '@superset-ui/core';

dayjs.extend(utc);

export const parseMetricValue = (metricValue: number | string | null) => {
  if (typeof metricValue === 'string') {
    const dateObject = dayjs.utc(metricValue, undefined, true);
    if (dateObject.isValid()) {
      return dateObject.valueOf();
    }
    return null;
  }
  return metricValue;
};

export const getDateFormatter = (
  timeFormat: string,
  granularity?: TimeGranularity,
  fallbackFormat?: string | null,
) =>
  timeFormat === SMART_DATE_ID
    ? getTimeFormatterForGranularity(granularity)
    : getTimeFormatter(timeFormat ?? fallbackFormat);


function getVariableData(
  calculationType: string,
  data: Record<string, any>[],
  metricName: string,
) {
  if (!data[0]?.hasOwnProperty(metricName)) return null;
  if (calculationType === 'last') return data[data.length - 1][metricName];
  if (calculationType === 'first') return data[0][metricName];
  if (calculationType === 'sum') {
    return data.reduce((acc, item) => acc + item[metricName], 0);
  }
  if (calculationType === 'average') {
    return data.reduce((acc, item) => acc + item[metricName], 0) / data.length;
  }
  if (calculationType === 'max') {
    return Math.max(...data.map(item => item[metricName]));
  }
  if (calculationType === 'min') {
    return Math.min(...data.map(item => item[metricName]));
  }
  return null;
}
// Get the metric name in the variable pattern: {{ metric name }}
function getVariableMetric(content: string) {
  const variableRegex = /\{\{\s*(.*?)\s*\}\}/;
  const match = content.match(variableRegex);
  if (!match) return null;
  return match[1];
}

function replaceVariableInContent(content: string, value: number) {
  return content.replace(/\{\{\s*.*?\s*\}\}/, value.toString());
}

export function replacePlaceholderWithValue({
  variableCalculation,
  data,
  content,
  numberFormatter,
}: {
  variableCalculation: string;
  data: Record<string, any>[];
  content: string;
  numberFormatter: Function;
}) {
  const metricName = getVariableMetric(content);

  if (metricName) {
    const value = getVariableData(variableCalculation, data, metricName);
    const formattedValue = numberFormatter(value);
    if (formattedValue !== null) {
      return replaceVariableInContent(content, formattedValue);
    }
  }
  return content;
}