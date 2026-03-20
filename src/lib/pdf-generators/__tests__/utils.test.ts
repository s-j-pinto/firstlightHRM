import { sanitizeText } from '../utils';

describe('sanitizeText utility', () => {
  it('should return an empty string for null or undefined input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });

  it('should remove non-printable control characters', () => {
    const dirtyText = 'Hello\x00\x08World\x1F!';
    expect(sanitizeText(dirtyText)).toBe('HelloWorld!');
  });

  it('should keep standard characters, numbers, and punctuation', () => {
    const text = 'This is a test! With numbers 123 and symbols @#$%.';
    expect(sanitizeText(text)).toBe(text);
  });

  it('should keep newline and carriage return characters', () => {
    const text = 'Line 1\nLine 2\r\nLine 3';
    expect(sanitizeText(text)).toBe(text);
  });

  it('should handle an empty string input', () => {
    expect(sanitizeText('')).toBe('');
  });
});
