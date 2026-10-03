import motion from "@/config/motion.json";
export { motion };
export const motionStyles = `:root{${Object.entries(motion.durations)
  .map(([key, value]) => `--motion-${key}:${value}ms`)
  .join(
    ";",
  )};--motion-ease:${motion.easing.standard};--motion-spring:${motion.easing.spring}}`;
