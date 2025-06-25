import { useEffect, useState, useRef } from 'react';
// @ts-ignore
// eslint-disable-next-line import/no-extraneous-dependencies
import { MDXProvider } from '@mdx-js/react';

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

const RenderMDXContent = ({ mdxContent }: { mdxContent: string }) => {
  const [contentWithoutScripts, setContentWithoutScripts] = useState('');
  const [scripts, setScripts] = useState<string[]>([]);
  const mdxContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let content = mdxContent;
    const scriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
    const extractedScripts = mdxContent.match(scriptRegex) || [];

    extractedScripts.forEach(script => {
      content = content.replace(script, '');
    });

    setContentWithoutScripts(decodeHtml(content));
    setScripts(
      extractedScripts.map(script =>
        script.replace(/<script\b[^<]*>|<\/script>/gi, ''),
      ),
    );
  }, [mdxContent]);

  useEffect(() => {
    const container = mdxContainerRef.current;

    // Function to execute scripts after ensuring the chart container is available
    const executeScripts = () => {
      if (!container) {
        setTimeout(executeScripts, 100); // Retry after 100ms if the container is not found
        return;
      }

      // Remove any existing scripts
      const existingScripts = container.querySelectorAll('script');
      existingScripts.forEach(script => script.remove());

      // Execute new scripts by appending them to the container
      scripts.forEach(scriptContent => {
        const scriptTag = document.createElement('script');
        scriptTag.type = 'text/javascript';
        scriptTag.async = true;
        scriptTag.innerHTML = `(function() { ${scriptContent} })();`;
        container.appendChild(scriptTag);
      });
    };

    executeScripts();

    // Cleanup function to remove scripts when content changes
    return () => {
      const existingScripts = container?.querySelectorAll('script');
      existingScripts?.forEach(script => script.remove());
    };
  }, [contentWithoutScripts, scripts]);

  return (
    <div
      ref={mdxContainerRef}
      dangerouslySetInnerHTML={{ __html: contentWithoutScripts }}
    />
  );
};

export function SafeMarkdownJS({ source }: { source: string }) {
  return (
    <MDXProvider>
      <RenderMDXContent mdxContent={source} />
    </MDXProvider>
  );
}
