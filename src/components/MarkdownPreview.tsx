import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
  mangle: false,
});

interface MarkdownPreviewProps {
  content: string;
  title?: string;
}

export function MarkdownPreview({ content, title = 'Rendered Preview' }: MarkdownPreviewProps) {
  if (!content || !content.trim()) return null;

  // Normalize various newline encodings and escaped sequences
  const normalized = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\n/g, '\n');

  const html = marked.parse(normalized);
  return (
    <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html as string }} />
    </div>
  );
}