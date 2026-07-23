import { motion } from 'framer-motion';

export const Scene5 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5 }}
    >
      {/* Background is already dark from VideoTemplate */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated stars/dots for evening stroll vibe */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-30"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.1, 0.5, 0.1],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="z-10 flex flex-col items-center">
        <motion.h2
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-[5vw] font-display font-bold text-white mb-12 text-center"
        >
          For evening strolls. <br/>
          <span className="text-accent">Beautiful dark mode.</span>
        </motion.h2>

        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-[40vw] bg-[#112418] border border-[#2E8B57]/30 rounded-[2vw] p-[2vw] shadow-2xl flex flex-col items-center"
        >
          <div className="w-full flex justify-between items-center mb-[2vw]">
            <div className="flex gap-[1vw]">
              <div className="w-[3vw] h-[3vw] rounded-full bg-primary flex items-center justify-center">
                <span className="text-white text-[1.5vw]">⭐</span>
              </div>
              <div>
                <h3 className="text-white font-display font-bold text-[1.6vw] leading-tight">Sunset Lake Path</h3>
                <p className="text-accent font-body text-[1.2vw]">Saved Route • 3.5km</p>
              </div>
            </div>
            
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 2, type: 'spring' }}
              className="bg-[#2E8B57] text-white px-[1.5vw] py-[0.8vw] rounded-full font-bold text-[1.2vw] flex items-center gap-2"
            >
              Share with friends
            </motion.div>
          </div>

          <div className="w-full h-[15vw] rounded-[1vw] overflow-hidden relative opacity-80">
            <img 
              src={`${import.meta.env.BASE_URL}images/topo-map.png`} 
              className="absolute inset-0 w-full h-full object-cover invert hue-rotate-[180deg] brightness-50"
              alt="Dark Map"
            />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <motion.path 
                d="M 10 90 Q 40 40 90 10"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="4"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, delay: 1.5, ease: 'easeInOut' }}
              />
            </svg>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
