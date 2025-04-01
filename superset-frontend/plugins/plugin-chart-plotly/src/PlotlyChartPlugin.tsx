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
import React from 'react';
// @ts-ignore
import Plot from 'react-plotly.js';
import { PluginChartPlotlyProps } from './types';
import styles from './styles';

export default function PlotlyChartPlugin(props: PluginChartPlotlyProps) {
  const { plotly } = props;

  // Parse the plotly JSON string to an object
  const plotlyObject = JSON.parse(plotly);

  const isDashboard = window.location.href.includes('/dashboard/');

  const config = {
    responsive: true,
    displayModeBar: !isDashboard,
  };

  const layout = {
    ...plotlyObject.layout,
    autosize: true,
    margin: {
      t: isDashboard ? 40 : 70,
      b: isDashboard ? 40 : 5,
      r: 5,
      l: 5,
      pad: 5,
      autoexpand: true,
    },
  };

  return (
    // @ts-ignore
    <div style={styles.wrapper}>
      <Plot
        data={plotlyObject.data}
        layout={layout}
        useResizeHandler
        config={config}
        style={styles.plotlyObject}
      />
    </div>
  );
}
