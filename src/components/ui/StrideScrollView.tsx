import { forwardRef } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

/**
 * ScrollView with a deliberate rubber-band / overscroll give even when
 * content is shorter than the viewport (Android defaults to suppressing that).
 */
export const StrideScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function StrideScrollView(
    {
      overScrollMode = "always",
      bounces = true,
      alwaysBounceVertical,
      ...props
    },
    ref
  ) {
    return (
      <ScrollView
        ref={ref}
        overScrollMode={overScrollMode}
        bounces={bounces}
        alwaysBounceVertical={alwaysBounceVertical ?? !props.horizontal}
        {...props}
      />
    );
  }
);
