export function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/^>\s+/gm, '') // Blockquotes
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1') // Italics
    .replace(/`([^`]+)`/g, '$1') // Inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/#{1,6}\s+/g, '') // Headers
    .replace(/\n/g, ' ') // Replace newlines with spaces for a continuous paragraph
    .trim();
}
