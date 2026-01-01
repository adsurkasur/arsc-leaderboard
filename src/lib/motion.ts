/**
 * Motion System for ARSC Leaderboard
 * 
 * A centralized motion design system using Framer Motion.
 * All animation variants, transitions, and utilities are exported from here
 * to ensure consistency and maintainability across the app.
 * 
 * Design Principles:
 * - Animations reinforce hierarchy and user actions
 * - Spring-based easing for natural, playful feel
 * - Stagger effects create visual flow
 * - Reduced motion support is built-in
 * 
 * Usage:
 * import { fadeInUp, staggerContainer, springTransition } from '@/lib/motion';
 * <motion.div variants={fadeInUp} initial="hidden" animate="visible" />
 */

import { Variants, Transition, TargetAndTransition } from 'framer-motion';

// =============================================================================
// TRANSITION PRESETS
// =============================================================================

/**
 * Spring transition - bouncy, playful feel for interactive elements
 * Use for: buttons, cards, small UI elements
 */
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
  mass: 0.5,
};

/**
 * Smooth spring - more controlled, professional feel
 * Use for: page transitions, modals, larger elements
 */
export const smoothSpring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

/**
 * Quick spring - snappy micro-interactions
 * Use for: hover states, toggles, small feedback
 */
export const quickSpring: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.3,
};

/**
 * Gentle ease - smooth, non-bouncy transitions
 * Use for: fade effects, opacity changes
 */
export const gentleEase: Transition = {
  duration: 0.4,
  ease: [0.25, 0.46, 0.45, 0.94],
};

/**
 * Fast ease - quick transitions
 * Use for: tooltips, dropdowns
 */
export const fastEase: Transition = {
  duration: 0.2,
  ease: [0.25, 0.46, 0.45, 0.94],
};

// =============================================================================
// VARIANT PRESETS
// =============================================================================

/**
 * Fade in with upward motion - primary entrance animation
 * Great for: hero content, cards, sections
 */
export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: smoothSpring,
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: fastEase,
  },
};

/**
 * Fade in with downward motion
 * Great for: dropdowns, floating elements from top
 */
export const fadeInDown: Variants = {
  hidden: {
    opacity: 0,
    y: -20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: smoothSpring,
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: fastEase,
  },
};

/**
 * Fade in with scale - attention-grabbing entrance
 * Great for: modals, popups, important notifications
 */
export const fadeInScale: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: smoothSpring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: fastEase,
  },
};

/**
 * Pop effect - playful, bouncy entrance
 * Great for: badges, icons, success states
 */
export const popIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: fastEase,
  },
};

/**
 * Slide in from left
 * Great for: sidebars, nav items
 */
export const slideInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: smoothSpring,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: fastEase,
  },
};

/**
 * Slide in from right
 * Great for: sidebars, panels
 */
export const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: smoothSpring,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: fastEase,
  },
};

// =============================================================================
// STAGGER CONTAINER VARIANTS
// =============================================================================

/**
 * Stagger container - orchestrates child animations
 * Use as parent with child elements using item variants
 * 
 * Usage:
 * <motion.ul variants={staggerContainer} initial="hidden" animate="visible">
 *   <motion.li variants={staggerItem}>Item 1</motion.li>
 *   <motion.li variants={staggerItem}>Item 2</motion.li>
 * </motion.ul>
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

/**
 * Fast stagger container - quicker child animations
 * Good for: shorter lists, fast reveals
 */
export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

/**
 * Slow stagger container - dramatic reveals
 * Good for: hero sections, important content
 */
export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

/**
 * Stagger item - default child animation for stagger containers
 */
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: smoothSpring,
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: fastEase,
  },
};

/**
 * Stagger item with scale - more playful child animation
 */
export const staggerItemScale: Variants = {
  hidden: {
    opacity: 0,
    y: 15,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: fastEase,
  },
};

// =============================================================================
// INTERACTION VARIANTS
// =============================================================================

/**
 * Button hover/tap states
 * Use with whileHover and whileTap props
 * 
 * Usage:
 * <motion.button whileHover={buttonHover} whileTap={buttonTap}>
 */
export const buttonHover: TargetAndTransition = {
  scale: 1.02,
  transition: quickSpring,
};

export const buttonTap: TargetAndTransition = {
  scale: 0.98,
  transition: quickSpring,
};

/**
 * Card hover effect - subtle lift
 */
export const cardHover: TargetAndTransition = {
  y: -4,
  transition: smoothSpring,
};

/**
 * Icon hover - playful bounce
 */
export const iconHover: TargetAndTransition = {
  scale: 1.1,
  rotate: 5,
  transition: springTransition,
};

/**
 * Link hover - subtle scale
 */
export const linkHover: TargetAndTransition = {
  scale: 1.05,
  transition: quickSpring,
};

// =============================================================================
// PAGE TRANSITION VARIANTS
// =============================================================================

/**
 * Page transition - smooth fade with slight movement
 * Use with AnimatePresence and page wrapper
 */
export const pageTransition: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
      when: 'beforeChildren',
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// =============================================================================
// MODAL VARIANTS
// =============================================================================

/**
 * Modal overlay - fade in/out
 */
export const modalOverlay: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

/**
 * Modal content - scale + fade with spring
 */
export const modalContent: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: smoothSpring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: fastEase,
  },
};

// =============================================================================
// SPECIAL EFFECTS
// =============================================================================

/**
 * Shimmer effect for loading states
 * Apply to skeleton elements
 */
export const shimmer: Variants = {
  hidden: { x: '-100%' },
  visible: {
    x: '100%',
    transition: {
      repeat: Infinity,
      duration: 1.5,
      ease: 'linear',
    },
  },
};

/**
 * Pulse animation for attention
 */
export const pulse: Variants = {
  hidden: { scale: 1 },
  visible: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Float animation - gentle up/down motion
 */
export const float: Variants = {
  hidden: { y: 0 },
  visible: {
    y: [0, -8, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// =============================================================================
// REDUCED MOTION HELPERS
// =============================================================================

/**
 * Check if user prefers reduced motion
 * Use this to conditionally disable animations
 * 
 * Usage:
 * const shouldReduceMotion = useReducedMotion();
 * <motion.div animate={shouldReduceMotion ? {} : { scale: 1.1 }} />
 */
export const reducedMotionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

// =============================================================================
// TABLE ROW VARIANTS (for leaderboard)
// =============================================================================

/**
 * Table row stagger - optimized for table rows
 */
export const tableRowContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const tableRow: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: smoothSpring,
  },
};

// =============================================================================
// HERO SECTION VARIANTS
// =============================================================================

/**
 * Hero title - dramatic entrance
 */
export const heroTitle: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      ...smoothSpring,
      delay: 0.1,
    },
  },
};

/**
 * Hero subtitle - follows title
 */
export const heroSubtitle: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      ...smoothSpring,
      delay: 0.2,
    },
  },
};

/**
 * Hero CTA - attention-grabbing entrance
 */
export const heroCTA: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...springTransition,
      delay: 0.3,
    },
  },
};
