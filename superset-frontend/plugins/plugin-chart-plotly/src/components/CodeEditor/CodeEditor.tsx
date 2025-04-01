/* eslint-disable import/no-extraneous-dependencies */
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

import React, { FC } from 'react';
import AceEditor, { IAceEditorProps } from 'react-ace';
import 'brace/mode/python';
import 'brace/theme/monokai';

export type CodeEditorMode = 'python';
export type CodeEditorTheme = 'light' | 'dark';

export interface CodeEditorProps extends IAceEditorProps {
  mode?: CodeEditorMode;
  theme?: CodeEditorTheme;
  name?: string;
}

export const CodeEditor: FC<CodeEditorProps> = ({
  name,
  width,
  height,
  value,
  ...rest
}: CodeEditorProps) => {
  const m_name = name || Math.random().toString(36).substring(7);
  const m_height = height || '300px';
  const m_width = width || '100%';

  return (
    <div className="code-editor" style={{ minHeight: height, width: m_width }}>
      <AceEditor
        mode="python"
        theme="monokai"
        name={m_name}
        height={m_height}
        width={m_width}
        fontSize={14}
        showPrintMargin
        focus
        editorProps={{ $blockScrolling: true }}
        wrapEnabled
        highlightActiveLine
        value={value}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 2,
          showGutter: true,
        }}
        {...rest}
      />
    </div>
  );
};
