import { motion } from 'framer-motion';

export const Scene1 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0">
        <video
          src={`${import.meta.env.BASE_URL}videos/forest-walk.mp4`}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B2213] via-[#0B2213]/40 to-transparent opacity-80" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-4 mb-6"
        >
          <img 
            src={`${import.meta.env.BASE_URL}images/compass-icon.png`}
            alt="Compass"
            className="w-20 h-20 drop-shadow-2xl brightness-200"
          />
        </motion.div>

        <div className="overflow-hidden mb-4">
          <motion.h1
            initial={{ y: '100%', rotate: 5 }}
            animate={{ y: 0, rotate: 0 }}
            transition={{ duration: 1.2, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-[10vw] font-display font-black text-white leading-none tracking-tight drop-shadow-xl"
          >
            Walkable
          </motion.h1>
        </div>

        <div className="overflow-hidden">
          <motion.p
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-[3vw] font-body font-medium text-accent tracking-wide drop-shadow-md"
          >
            Discover your path.
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
};
