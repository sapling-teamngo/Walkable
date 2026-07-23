import { motion } from 'framer-motion';

export const Scene2 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-between px-[10vw]"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-1/2 pr-16 z-10">
        <motion.div 
          className="overflow-hidden mb-6"
        >
          <motion.h2 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-[6vw] font-display font-bold text-primary leading-[1.1] tracking-tight"
          >
            Plan the <br/>
            <span className="text-secondary">perfect route</span>
          </motion.h2>
        </motion.div>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-[2.2vw] font-body text-text-secondary leading-snug"
        >
          Choose between flat, easy strolls <br/> or fast-paced workouts.
        </motion.p>
      </div>

      <div className="w-1/2 flex justify-center relative">
        <motion.div 
          initial={{ y: 100, opacity: 0, rotateY: 20, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, rotateY: -10, scale: 1 }}
          transition={{ duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-[28vw] h-[55vw] max-h-[80vh] bg-white rounded-[3vw] shadow-2xl overflow-hidden relative border-[0.5vw] border-gray-100 flex flex-col"
          style={{ perspective: 1000 }}
        >
          {/* Map background */}
          <div className="absolute inset-0 bg-bg-muted opacity-50" />
          
          {/* Grid lines */}
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'linear-gradient(var(--color-accent) 1px, transparent 1px), linear-gradient(90deg, var(--color-accent) 1px, transparent 1px)',
            backgroundSize: '4vw 4vw',
            opacity: 0.2
          }} />

          {/* Map Route SVG */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <motion.path 
              d="M 20 80 Q 30 50 50 60 T 80 20"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: 1, ease: 'easeInOut' }}
            />
            {/* Start point */}
            <motion.circle 
              cx="20" cy="80" r="4" fill="var(--color-secondary)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.8, type: 'spring' }}
            />
            {/* End point */}
            <motion.circle 
              cx="80" cy="20" r="4" fill="var(--color-primary)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 2.8, type: 'spring' }}
            />
          </svg>

          {/* UI Overlays */}
          <div className="mt-auto p-[1.5vw] bg-white rounded-t-[2vw] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] relative z-10 flex flex-col gap-[1vw]">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 3, ease: [0.16, 1, 0.3, 1] }}
              className="flex justify-between items-center"
            >
              <div>
                <div className="text-[1.8vw] font-display font-bold text-text-primary">Morning Loop</div>
                <div className="text-[1.2vw] font-body text-text-secondary">4.2 km • Flat</div>
              </div>
              <div className="bg-primary text-white text-[1.2vw] px-[1vw] py-[0.5vw] rounded-full font-bold">
                45 min
              </div>
            </motion.div>

            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 3.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-[3vw] bg-primary rounded-[1vw] flex items-center justify-center text-white font-bold text-[1.4vw]"
            >
              Start Walk
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
