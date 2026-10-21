//#region src/parser/expression/regexes.d.ts
type Currency = {
  raw: string;
  value: number;
  currency: string;
};
//#endregion
//#region src/parser/expression/custom.d.ts
type CustomParameterExpressionArgs<T> = {
  name: string;
  regexp: RegExp;
  transformer: (value: string) => T;
};
declare const defineParameterExpression: <T>(args: CustomParameterExpressionArgs<T>) => void;
//#endregion
export { defineParameterExpression as n, Currency as r, CustomParameterExpressionArgs as t };