import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, Coins, TrendingUp, TrendingDown } from "lucide-react";

interface MoneyParticle {
  id: string;
  x: number;
  icon: "dollar" | "coins" | "trending";
  delay: number;
}

interface MoneyFlowAnimationProps {
  amount: number;
  type: "increase" | "decrease";
  trigger: boolean;
  onComplete?: () => void;
}

export function MoneyFlowAnimation({ amount, type, trigger, onComplete }: MoneyFlowAnimationProps) {
  const [particles, setParticles] = useState<MoneyParticle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    // Generate particles based on amount magnitude
    const particleCount = Math.min(Math.floor(amount / 1000) + 3, 12);
    const newParticles: MoneyParticle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const icons: ("dollar" | "coins" | "trending")[] = ["dollar", "coins", "trending"];
      newParticles.push({
        id: `${Date.now()}-${i}`,
        x: Math.random() * 80 + 10, // 10-90% horizontal spread
        icon: icons[Math.floor(Math.random() * icons.length)],
        delay: Math.random() * 0.3,
      });
    }

    setParticles(newParticles);

    // Clear particles after animation
    const timeout = setTimeout(() => {
      setParticles([]);
      onComplete?.();
    }, 2500);

    return () => clearTimeout(timeout);
  }, [trigger, amount, onComplete]);

  const renderIcon = (iconType: "dollar" | "coins" | "trending") => {
    const iconClass = `h-6 w-6 ${type === "increase" ? "text-green-400" : "text-red-400"}`;
    
    switch (iconType) {
      case "dollar":
        return <DollarSign className={iconClass} />;
      case "coins":
        return <Coins className={iconClass} />;
      case "trending":
        return type === "increase" ? 
          <TrendingUp className={iconClass} /> : 
          <TrendingDown className={iconClass} />;
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              x: `${particle.x}%`,
              y: "100%",
              opacity: 0,
              scale: 0,
              rotate: 0,
            }}
            animate={{
              y: type === "increase" ? "-20%" : "120%",
              opacity: [0, 1, 1, 0],
              scale: [0, 1.2, 1, 0.8],
              rotate: [0, 360],
            }}
            exit={{
              opacity: 0,
              scale: 0,
            }}
            transition={{
              duration: 2,
              delay: particle.delay,
              ease: "easeOut",
            }}
            className="absolute"
            style={{
              filter: "drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))",
            }}
          >
            {renderIcon(particle.icon)}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Money emoji burst */}
      <AnimatePresence>
        {particles.length > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="text-6xl">
              {type === "increase" ? "💰" : "💸"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Compact version for smaller areas like cards
export function CompactMoneyFlowAnimation({ amount, type, trigger }: Omit<MoneyFlowAnimationProps, "onComplete">) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    
    setShow(true);
    const timeout = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(timeout);
  }, [trigger]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0, y: 0 }}
          animate={{ 
            scale: [0, 1.2, 0],
            opacity: [0, 1, 0],
            y: type === "increase" ? -50 : 50,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
        >
          <div className="text-5xl">
            {type === "increase" ? "💚" : "💔"}
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`absolute text-xl font-bold ${
              type === "increase" ? "text-green-500" : "text-red-500"
            }`}
            style={{
              textShadow: "0 0 10px rgba(168, 85, 247, 0.8)",
            }}
          >
            {type === "increase" ? "+" : "-"}UGX {amount.toLocaleString()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Ripple effect for wallet card
export function WalletRippleEffect({ trigger }: { trigger: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    
    setShow(true);
    const timeout = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(timeout);
  }, [trigger]);

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 rounded-xl bg-purple-400/30 pointer-events-none"
          />
          <motion.div
            initial={{ scale: 0, opacity: 0.4 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
            className="absolute inset-0 rounded-xl bg-white/40 pointer-events-none"
          />
        </>
      )}
    </AnimatePresence>
  );
}
