import { motion, AnimatePresence, Variants } from "framer-motion";
import { ReactNode } from "react";

const itemVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    scale: 0.95
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: -10,
    transition: {
      duration: 0.2
    }
  }
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
}

export const AnimatedList = ({ children, className }: AnimatedListProps) => {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface AnimatedItemProps {
  children: ReactNode;
  itemKey: string;
  className?: string;
}

export const AnimatedItem = ({ children, itemKey, className }: AnimatedItemProps) => {
  return (
    <motion.div
      key={itemKey}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface AnimatedListContainerProps {
  children: ReactNode;
  className?: string;
}

export const AnimatedListContainer = ({ children, className }: AnimatedListContainerProps) => {
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
