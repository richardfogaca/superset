import { PluginChartPlotlyProps } from '../types';

export default function transformProps(chartProps: PluginChartPlotlyProps) {
  // @ts-ignore
  const { width, height, formData, queriesData } = chartProps;
  const { boldText, headerFontSize, headerText } = formData;
  // @ts-ignore
  const { plotly, data } = queriesData[0];

  return {
    width,
    height,
    data,
    boldText,
    headerFontSize,
    headerText,
    plotly,
  };
}
