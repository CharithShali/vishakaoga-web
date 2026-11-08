// Shows plain text as paragraphs: a blank line starts a new paragraph, a single
// line break stays a line break, and web links become clickable.
// (No HTML is ever inserted, so nothing typed can break the page.)

const LINK = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

function withLinks(line, key) {
  return line.split(LINK).map((part, i) =>
    i % 2 === 1 ? (
      <a key={`${key}-${i}`} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    ) : (
      part
    )
  );
}

export default function RichText({ text, className = 'rich-text' }) {
  const paragraphs = String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div className={className}>
      {paragraphs.map((p, i) => (
        <p key={i}>
          {p.split('\n').map((line, j, lines) => (
            <span key={j}>
              {withLinks(line, `${i}-${j}`)}
              {j < lines.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
