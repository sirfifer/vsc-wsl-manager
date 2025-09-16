import { describe, it, expect } from 'vitest';

describe('Simple Test', () => {
    it('should pass basic math', () => {
        expect(1 + 1).toBe(2);
    });

    it('should handle arrays', () => {
        expect([1, 2, 3]).toEqual([1, 2, 3]);
    });

    it('should handle objects', () => {
        expect({ name: 'test' }).toEqual({ name: 'test' });
    });
});