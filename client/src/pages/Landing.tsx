import { motion } from "framer-motion";
import { Link } from "wouter";
import { Sparkles, Swords, Scroll, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Background Fog */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      
      <div className="max-w-4xl w-full relative z-10 space-y-12">
        <div className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-display font-bold text-primary tracking-tight"
          >
            D&D DM Toolkit
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground font-serif italic"
          >
            "Tools for the Master of Dungeons"
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/loot">
              <Card className="group cursor-pointer hover-elevate transition-all duration-300 border-2 hover:border-primary/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-display font-bold">Deck of Loot</h2>
                    <p className="text-muted-foreground font-serif">
                      Draw magical artifacts, weapons, and wondrous items from a vast compendium.
                    </p>
                  </div>
                  <Button variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground">
                    Enter the Archives
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Link href="/initiative">
              <Card className="group cursor-pointer hover-elevate transition-all duration-300 border-2 hover:border-primary/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Swords className="w-10 h-10 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-display font-bold">Initiative Tracker</h2>
                    <p className="text-muted-foreground font-serif">
                      Manage combat order, track HP, and keep the battle flowing smoothly.
                    </p>
                  </div>
                  <Button variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground">
                    Start Combat
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
