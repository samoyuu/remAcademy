// Minimal ambient typing for webpack's require.context, used to auto-load
// every file in src/data/subjects/ without listing them individually.
interface RequireContext {
  keys(): string[];
  <T = any>(id: string): T;
}
declare const require: {
  context(directory: string, useSubdirectories: boolean, regExp: RegExp): RequireContext;
};
