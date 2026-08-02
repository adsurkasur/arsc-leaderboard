import type { TargetAndTransition, Transition, Variants } from 'framer-motion';

/**
 * Central motion tokens for the app. Entrances share one restrained easing,
 * exits are shorter, and interactive movement stays within two pixels.
 */
const productiveEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
const exitEase: [number, number, number, number] = [0.4, 0, 1, 1];

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.45,
};

export const smoothSpring: Transition = {
  type: 'tween',
  duration: 0.34,
  ease: productiveEase,
};

export const quickSpring: Transition = {
  type: 'tween',
  duration: 0.16,
  ease: productiveEase,
};

export const gentleEase: Transition = {
  duration: 0.34,
  ease: productiveEase,
};

export const fastEase: Transition = {
  duration: 0.16,
  ease: exitEase,
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: smoothSpring },
  exit: { opacity: 0, y: -6, transition: fastEase },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: smoothSpring },
  exit: { opacity: 0, y: -6, transition: fastEase },
};

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: smoothSpring },
  exit: { opacity: 0, scale: 0.985, transition: fastEase },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: springTransition },
  exit: { opacity: 0, scale: 0.98, transition: fastEase },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: smoothSpring },
  exit: { opacity: 0, x: -8, transition: fastEase },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: smoothSpring },
  exit: { opacity: 0, x: 8, transition: fastEase },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.025, staggerDirection: -1 },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.035, delayChildren: 0.025 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.075, delayChildren: 0.08 },
  },
};

export const staggerItem: Variants = fadeInUp;

export const staggerItemScale: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: smoothSpring },
  exit: { opacity: 0, y: -4, transition: fastEase },
};

export const buttonHover: TargetAndTransition = {
  y: -1,
  transition: quickSpring,
};

export const buttonTap: TargetAndTransition = {
  y: 0,
  scale: 0.99,
  transition: quickSpring,
};

export const cardHover: TargetAndTransition = {
  y: -2,
  transition: quickSpring,
};

export const iconHover: TargetAndTransition = {
  y: -1,
  transition: quickSpring,
};

export const linkHover: TargetAndTransition = {
  y: -1,
  transition: quickSpring,
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...smoothSpring, when: 'beforeChildren' },
  },
  exit: { opacity: 0, y: -5, transition: fastEase },
};

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.985, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: smoothSpring },
  exit: { opacity: 0, scale: 0.99, y: 4, transition: fastEase },
};

export const shimmer: Variants = {
  hidden: { x: '-100%' },
  visible: {
    x: '100%',
    transition: { repeat: Infinity, duration: 1.5, ease: 'linear' },
  },
};

export const pulse: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: [1, 0.72, 1],
    transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const float: Variants = {
  hidden: { y: 0 },
  visible: {
    y: [0, -3, 0],
    transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const reducedMotionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

export const tableRowContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.035, delayChildren: 0.04 },
  },
};

export const tableRow: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: smoothSpring },
};

export const heroTitle: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { ...smoothSpring, delay: 0.05 } },
};

export const heroSubtitle: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { ...smoothSpring, delay: 0.1 } },
};

export const heroCTA: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { ...smoothSpring, delay: 0.15 } },
};
