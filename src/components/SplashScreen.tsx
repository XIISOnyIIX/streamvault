
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onAnimationComplete();
    }, 3500); // Total duration of animation (1s pop + 1.5s pause + 1s go down)
    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  return (
    <div className="fixed inset-0 bg-sv-bg-deep flex items-center justify-center z-[100]">
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, type: 'spring', stiffness: 100, delay: 0.2 }}
        className="text-center"
      >
        <motion.div
          // This inner motion.div will handle the "go down" animation after a pause
          animate={{ y: [0, 0, 100], opacity: [1, 1, 0], scale: [1,1, 0.8] }}
          transition={{ duration: 1, delay: 2.5, ease: "anticipate" }} // 1s pop + 1.5s pause = 2.5s delay before going down
        >
          <h1 className="text-5xl font-bold mb-4 
            bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple 
            bg-clip-text text-transparent"
          >
            Welcome to StreamVault
          </h1>
          <p className="text-2xl text-sv-text-secondary">
            Enjoy 🍿!
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default SplashScreen;
