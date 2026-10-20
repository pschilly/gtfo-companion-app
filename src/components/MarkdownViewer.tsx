import React from 'react';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

/**
 * Lightweight, zero-dependency Markdown & HTML renderer tailored for GTFO mod/livery descriptions.
 * Safely parses Headings, Bold, Italic, Lists, Links, Blockquotes, Inline Code, and Paragraphs.
 */
export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  // Split into block tokens by double newlines or structural markers
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let blockKey = 0;

  const flushList = () => {
    if (!currentList) return;
    const ListTag = currentList.type;
    const listClasses =
      currentList.type === 'ul'
        ? 'list-disc list-outside ml-4 space-y-1 my-2 text-stone-300'
        : 'list-decimal list-outside ml-4 space-y-1 my-2 text-stone-300';

    blocks.push(
      <ListTag key={`list-${blockKey++}`} className={listClasses}>
        {currentList.items.map((item, idx) => (
          <li key={idx} className="leading-relaxed">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ListTag>
    );
    currentList = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Empty line separates paragraphs / lists
    if (!trimmed) {
      flushList();
      continue;
    }

    // Unordered list item: - or *
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Ordered list item: 1.
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[1]);
      continue;
    }

    // Flush any ongoing list before non-list elements
    flushList();

    // Headings
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h3
          key={`h3-${blockKey++}`}
          className="text-base font-display font-bold text-amber-300 mt-4 mb-1.5"
        >
          {renderInlineMarkdown(trimmed.slice(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2
          key={`h2-${blockKey++}`}
          className="text-lg font-display font-bold text-stone-100 mt-4 mb-2 border-b border-stone-800 pb-1"
        >
          {renderInlineMarkdown(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h1
          key={`h1-${blockKey++}`}
          className="text-xl font-display font-bold text-amber-400 mt-5 mb-2 border-b border-stone-800/80 pb-1.5"
        >
          {renderInlineMarkdown(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      blocks.push(
        <blockquote
          key={`quote-${blockKey++}`}
          className="border-l-2 border-amber-500/60 bg-stone-950/50 pl-3.5 py-1.5 my-2 italic text-stone-400 text-xs rounded-r"
        >
          {renderInlineMarkdown(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      blocks.push(
        <hr key={`hr-${blockKey++}`} className="border-stone-800 my-4" />
      );
      continue;
    }

    // Standard paragraph
    blocks.push(
      <p
        key={`p-${blockKey++}`}
        className="text-sm text-stone-300 leading-relaxed mb-2 last:mb-0"
      >
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  flushList();

  return (
    <div className={`prose-gtfo space-y-2 text-stone-300 ${className}`}>
      {blocks}
    </div>
  );
};

/**
 * Parses inline formatting:
 * **bold**, *italic*, `code`, and [link](url)
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  // Regex to match code, bold, italic, and links
  const pattern =
    /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+(?!\*)|(?<!_)_[^_]+(?!_)|\[[^\]]+\]\([^)]+\)|<br\s*\/?>)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `inline-${match.index}`;

    if (token === '<br>' || token === '<br/>' || token === '<br />') {
      parts.push(<br key={key} />);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800 text-amber-300 font-mono text-xs"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      parts.push(
        <strong key={key} className="font-semibold text-stone-100">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      parts.push(
        <em key={key} className="italic text-stone-200">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2 decoration-amber-500/40 hover:decoration-amber-400 transition-colors"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(token);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Strips markdown symbols for short plain-text previews (e.g. Card descriptions)
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return '';
  return markdown
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/^[-*+]\s+/gm, '') // Remove list bullets
    .replace(/^\d+\.\s+/gm, '') // Remove numbered lists
    .replace(/^>\s+/gm, '') // Remove blockquotes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) -> link
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/`([^`]+)`/g, '$1') // code
    .replace(/<[^>]+>/g, '') // html tags
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}
