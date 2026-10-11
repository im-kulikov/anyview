/** Значение словаря только по собственному ключу: `dict['__proto__']`, `dict['constructor']` и т.п. не должны давать содержимое прототипа. */
export const own = <T>(dict: Record<string, T>, key: string): T | undefined => (Object.hasOwn(dict, key) ? dict[key] : undefined);
