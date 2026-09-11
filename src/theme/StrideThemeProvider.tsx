import { createContext, useContext, type PropsWithChildren } from "react";
const colors = {
  background: "#E8ECF4", surface: "#E8ECF4", ink: "#1E2633", muted: "#667085",
  accent: "#6C7CFF", accentSoft: "#DDE2FF", shadow: "#AEB7C7", shadowLight: "#D3D9E4", disabled: "#B9C0CC"
};
const Context = createContext({ colors });
export function StrideThemeProvider({ children }: PropsWithChildren) {
  return <Context.Provider value={{ colors }}>{children}</Context.Provider>;
}
export function useStrideTheme() { return useContext(Context); }
