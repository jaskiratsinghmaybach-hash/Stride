import type { PropsWithChildren } from "react";
import { View, type ViewProps } from "react-native";
import { useStrideTheme } from "@/theme/StrideThemeProvider";
type Props = PropsWithChildren<ViewProps>;
export function NeumorphicCard({ children, style, ...props }: Props) {
  const { colors } = useStrideTheme();
  return <View {...props} className={`rounded-[28px] p-5 ${props.className ?? ""}`} style={[
    { backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOffset: { width: 7, height: 7 }, shadowOpacity: .18, shadowRadius: 14, elevation: 7 }, style
  ]}>{children}</View>;
}
