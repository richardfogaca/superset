/*
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
import { useEffect, useMemo, useRef, useState } from 'react';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { mergeWith } from 'lodash';
import { MDXProvider } from '@mdx-js/react';
import { FeatureFlag, isFeatureEnabled } from '../utils';

interface SafeMarkdownProps {
  source: string;
  htmlSanitization?: boolean;
  htmlSchemaOverrides?: typeof defaultSchema;
  isJSEnabled?: boolean;
}

export function getOverrideHtmlSchema(
  originalSchema: typeof defaultSchema,
  htmlSchemaOverrides: SafeMarkdownProps['htmlSchemaOverrides'],
) {
  return mergeWith(originalSchema, htmlSchemaOverrides, (objValue, srcValue) =>
    Array.isArray(objValue) ? objValue.concat(srcValue) : undefined,
  );
}

const DEFAULT_BOOTSTRAP_DATA = {
  common: {
    enable_handlebars_javascript: false,
  },
};

export function getBootstrapData(): any {
  const appContainer = document.getElementById('app');
  const dataBootstrap = appContainer?.getAttribute('data-bootstrap');
  return dataBootstrap ? JSON.parse(dataBootstrap) : DEFAULT_BOOTSTRAP_DATA;
}

function decodeHtml(html: string) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

export function isHandlebarsJavascriptEnabled() {
  return getBootstrapData().common.enable_handlebars_javascript;
}

const HtmlScriptRenderer = ({ rawHtmlContent }: { rawHtmlContent: string }) => {
  const [processedHtmlMarkup, setProcessedHtmlMarkup] = useState('');
  const [scriptSourceCodes, setScriptSourceCodes] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let content = rawHtmlContent;
    const scriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
    const extractedScripts = rawHtmlContent.match(scriptRegex) || [];

    extractedScripts.forEach(script => {
      content = content.replace(script, '');
    });

    setProcessedHtmlMarkup(decodeHtml(content));
    setScriptSourceCodes(
      extractedScripts.map(script =>
        script.replace(/<script\b[^<]*>|<\/script>/gi, ''),
      ),
    );
  }, [rawHtmlContent]);

  useEffect(() => {
    const container = containerRef.current;

    const dynamicallyLoadScripts = () => {
      if (!container) {
        setTimeout(dynamicallyLoadScripts, 100);
        return;
      }

      const existingScripts = container.querySelectorAll('script');
      existingScripts.forEach(script => script.remove());

      scriptSourceCodes.forEach(scriptContent => {
        const scriptTag = document.createElement('script');
        scriptTag.type = 'text/javascript';
        scriptTag.async = true;
        scriptTag.innerHTML = `(function() { ${scriptContent} })();`;
        container.appendChild(scriptTag);
      });
    };

    dynamicallyLoadScripts();

    return () => {
      const existingScripts = container?.querySelectorAll('script');
      existingScripts?.forEach(script => script.remove());
    };
  }, [processedHtmlMarkup, scriptSourceCodes]);

  return (
    <div
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: processedHtmlMarkup }}
    />
  );
};

function SafeMarkdown({
  source,
  htmlSanitization = true,
  htmlSchemaOverrides = {},
  isJSEnabled = false,
}: SafeMarkdownProps) {
  const escapeHtml = isFeatureEnabled(FeatureFlag.EscapeMarkdownHtml);
  const [rehypeRawPlugin, setRehypeRawPlugin] = useState<any>(null);
  const [ReactMarkdown, setReactMarkdown] = useState<any>(null);
  useEffect(() => {
    Promise.all([import('rehype-raw'), import('react-markdown')]).then(
      ([rehypeRaw, ReactMarkdown]) => {
        setRehypeRawPlugin(() => rehypeRaw.default);
        setReactMarkdown(() => ReactMarkdown.default);
      },
    );
  }, []);

  const rehypePlugins = useMemo(() => {
    const rehypePlugins: any = [];
    if (!escapeHtml && rehypeRawPlugin) {
      rehypePlugins.push(rehypeRawPlugin);
      if (htmlSanitization) {
        const schema = getOverrideHtmlSchema(
          defaultSchema,
          htmlSchemaOverrides,
        );
        rehypePlugins.push([rehypeSanitize, schema]);
      }
    }
    return rehypePlugins;
  }, [escapeHtml, htmlSanitization, htmlSchemaOverrides, rehypeRawPlugin]);

  if (!ReactMarkdown || !rehypeRawPlugin) {
    return null;
  }

  if (isJSEnabled) {
    return (
      <MDXProvider>
        <HtmlScriptRenderer rawHtmlContent={source} />
      </MDXProvider>
    );
  }

  // React Markdown escapes HTML by default
  return (
    <ReactMarkdown
      rehypePlugins={rehypePlugins}
      remarkPlugins={[remarkGfm]}
      skipHtml={false}
      transformLinkUri={null}
    >
      {source}
    </ReactMarkdown>
  );
}

export default SafeMarkdown;
