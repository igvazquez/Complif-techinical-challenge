import { deepMerge } from './deep-merge.util';

describe('deepMerge', () => {
  it('should merge flat objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should deep merge nested objects', () => {
    const target = {
      config: {
        threshold: 100,
        enabled: true,
      },
    };
    const source = {
      config: {
        threshold: 200,
      },
    };

    const result = deepMerge(target, source);

    expect(result).toEqual({
      config: {
        threshold: 200,
        enabled: true,
      },
    });
  });

  it('should replace arrays instead of merging them', () => {
    const target = {
      items: [1, 2, 3],
    };
    const source = {
      items: [4, 5],
    };

    const result = deepMerge(target, source);

    expect(result).toEqual({ items: [4, 5] });
  });

  it('should handle null values in source', () => {
    const target = { a: 1, b: { c: 2 } };
    const source = { b: null };

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: 1, b: null });
  });

  it('should handle null values in target', () => {
    const target = { a: 1, b: null };
    const source = { b: { c: 2 } };

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: 1, b: { c: 2 } });
  });

  it('should not mutate original objects', () => {
    const target = { a: 1, nested: { b: 2 } };
    const source = { nested: { c: 3 } };

    const result = deepMerge(target, source);

    expect(target).toEqual({ a: 1, nested: { b: 2 } });
    expect(source).toEqual({ nested: { c: 3 } });
    expect(result).toEqual({ a: 1, nested: { b: 2, c: 3 } });
  });

  it('should handle deeply nested structures', () => {
    const target = {
      level1: {
        level2: {
          level3: {
            value: 'original',
            keep: true,
          },
        },
      },
    };
    const source = {
      level1: {
        level2: {
          level3: {
            value: 'overridden',
          },
        },
      },
    };

    const result = deepMerge(target, source);

    expect(result).toEqual({
      level1: {
        level2: {
          level3: {
            value: 'overridden',
            keep: true,
          },
        },
      },
    });
  });

  it('should handle rule config merging scenario', () => {
    const templateConfig = {
      conditions: {
        all: [{ fact: 'amount', operator: 'greaterThan', value: 1000 }],
      },
      event: {
        type: 'alert',
        params: { severity: 'LOW', category: 'AML' },
      },
    };
    const overrides = {
      event: {
        params: { severity: 'HIGH' },
      },
    };

    const result = deepMerge(templateConfig, overrides);

    expect(result).toEqual({
      conditions: {
        all: [{ fact: 'amount', operator: 'greaterThan', value: 1000 }],
      },
      event: {
        type: 'alert',
        params: { severity: 'HIGH', category: 'AML' },
      },
    });
  });

  it('should handle empty objects', () => {
    expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 });
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
    expect(deepMerge({}, {})).toEqual({});
  });
});
