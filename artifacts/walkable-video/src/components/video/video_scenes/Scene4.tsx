import { motion } from 'framer-motion';

export const Scene4 = () => {
  const steps = [
    { dir: '↑', text: 'Head north on Forest Trail', dist: '200m' },
    { dir: '↱', text: 'Turn right at the Old Oak', dist: '50m' },
    { dir: '↰', text: 'Slight left towards Lake View', dist: '1.2km' },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center px-[10vw]"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Left Text */}
      <div className="w-1/2 pr-10 z-20">
        <motion.div className="overflow-hidden mb-4">
          <motion.h2 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-[5.5vw] font-display font-bold text-primary leading-[1.1] tracking-tight"
          >
            Never lose <br/> your way.
          </motion.h2>
        </motion.div>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-[2vw] font-body text-text-secondary leading-snug mb-8"
        >
          Clear turn-by-turn directions<br/>and hidden spots to discover.
        </motion.p>
      </div>

      {/* Right UI Elements */}
      <div className="w-1/2 relative h-[60vh] perspective-[1200px]">
        <motion.div 
          initial={{ rotateY: 30, rotateX: 10, x: 100, opacity: 0 }}
          animate={{ rotateY: -15, rotateX: 5, x: 0, opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 flex flex-col justify-center gap-6"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ x: 100, opacity: 0, scale: 0.9 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 1 + (i * 0.3), type: 'spring', stiffness: 100 }}
              className="bg-white p-[1.5vw] rounded-[1.5vw] shadow-[0_20px_40px_rgba(27,107,58,0.1)] border border-gray-50 flex items-center gap-[1.5vw]"
            >
              <div className="w-[4vw] h-[4vw] rounded-full bg-bg-muted flex items-center justify-center text-[2vw] text-primary font-bold">
                {step.dir}
              </div>
              <div className="flex-1">
                <div className="text-[1.6vw] font-display font-bold text-text-primary leading-tight">{step.text}</div>
              </div>
              <div className="text-[1.4vw] font-body font-bold text-text-muted">
                {step.dist}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Floating POI bubbles */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 2.2, type: 'spring' }}
          className="absolute top-[10%] right-[-10%] bg-secondary text-white px-[1.5vw] py-[0.8vw] rounded-full shadow-lg font-display font-bold text-[1.2vw] flex items-center gap-2 transform rotate-12"
        >
          ☕ Cafe 200m
        </motion.div>

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 2.5, type: 'spring' }}
          className="absolute bottom-[20%] right-[-5%] bg-accent text-primary px-[1.5vw] py-[0.8vw] rounded-full shadow-lg font-display font-bold text-[1.2vw] flex items-center gap-2 transform -rotate-6"
        >
          📸 Scenic View
        </motion.div>
      </div>
    </motion.div>
  );
};
