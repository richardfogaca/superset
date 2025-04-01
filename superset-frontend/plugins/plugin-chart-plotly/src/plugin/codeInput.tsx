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
  ControlSetItem,
  CustomControlConfig,
  sharedControls,
} from '@superset-ui/chart-controls';
import { t, validateNonEmpty } from '@superset-ui/core';
import React from 'react';
import { CodeEditor } from '../components/CodeEditor/CodeEditor';
import { ControlHeader } from '../components/ControlHeader/controlHeader';
import { debounceFunc } from '../consts';

interface HandlebarsCustomControlProps {
  value: string;
}

const CodeInputControl = (
  props: CustomControlConfig<HandlebarsCustomControlProps>,
) => {
  const val = String(
    props?.value ? props?.value : props?.default ? props?.default : '',
  );

  return (
    <div>
      <ControlHeader>{props.label}</ControlHeader>
      <CodeEditor
        value={val}
        onChange={(source: string) => {
          debounceFunc(props.onChange, source || '');
        }}
        highlightActiveLine
      />
    </div>
  );
};

export const codeInputControlSetItem: ControlSetItem = {
  name: 'codeInput',
  config: {
    ...sharedControls.entity,
    type: CodeInputControl,
    label: t('Code Input'),
    description: t(
      'This code will be used to build the plotly chart on the backend',
    ),
    default: `import plotly.graph_objects as go
import plotly.express as px

def get_plotly(df):
    return go.Figure(
        px.bar(df, x="count", barmode="group")._data
    ).update_layout(barmode='relative')`,
    isInt: false,
    renderTrigger: true,
    validators: [validateNonEmpty],
    mapStateToProps: ({ controls }) => ({
      value: controls?.codeInput?.value,
    }),
  },
};
