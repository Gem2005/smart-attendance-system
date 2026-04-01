import { useMemo } from "react";
import { PanResponder } from "react-native";
import { usePathname, useRouter } from "expo-router";

const TAB_ROUTES = ["/", "/history", "/profile"];
const SWIPE_THRESHOLD = 70;
const SWIPE_RESTRAINT = 35;

export function useTabSwipe() {
  const router = useRouter();
  const pathname = usePathname();

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);
          return absDx > 10 && absDx > absDy;
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);

          if (absDx < SWIPE_THRESHOLD || absDy > SWIPE_RESTRAINT) return;

          const currentIndex = TAB_ROUTES.indexOf(pathname);
          if (currentIndex < 0) return;

          if (gestureState.dx < 0 && currentIndex < TAB_ROUTES.length - 1) {
            router.replace(TAB_ROUTES[currentIndex + 1]);
          } else if (gestureState.dx > 0 && currentIndex > 0) {
            router.replace(TAB_ROUTES[currentIndex - 1]);
          }
        },
      }),
    [pathname, router]
  );

  return panResponder.panHandlers;
}
