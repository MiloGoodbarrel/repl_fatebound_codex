import { useState } from "react";
import { Controls } from "@/components/Controls";
import { ItemCard } from "@/components/ItemCard";
import { useDrawItems } from "@/hooks/use-items";
import type { ItemResponse, DrawOptions } from "@shared/routes";
import { Scroll, Sparkles, Home as HomeIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const drawItemsMutation = useDrawItems();

  const handleDraw = async (options: DrawOptions) => {
    try {
      const drawnItems = await drawItemsMutation.mutateAsync(options);
      setItems(drawnItems);
    } catch (error) {
      // Error handled in hook via toast
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
      {/* Sidebar Controls - Mobile: Top, Desktop: Left */}
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0 border-b md:border-b-0 md:border-r border-border h-[30vh] md:h-full overflow-hidden">
        <Controls 
          onDraw={handleDraw} 
          isDrawing={drawItemsMutation.isPending}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      </div>

      {/* Main Content Area - Wood Table Surface */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 relative scrollbar-fantasy wood-table">
        {/* Vignette effect */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(20_30%_8%/0.6)_100%)]" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex justify-between items-center mb-8">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <HomeIcon className="w-4 h-4" /> Back to Home
              </Button>
            </Link>
          </div>

          <AnimatePresence mode="wait">
            {items.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6"
              >
                <div className="w-32 h-32 rounded-full parchment flex items-center justify-center shadow-2xl">
                  <Scroll className="w-16 h-16 text-amber-700/70" />
                </div>
                <div className="max-w-md space-y-2 parchment p-6 rounded-lg">
                  <h1 className="text-3xl md:text-4xl font-display font-bold text-amber-800">
                    Awaiting Destiny
                  </h1>
                  <p className="ink-faded font-serif text-lg">
                    Select your criteria from the archives and draw your fate.
                    <br />
                    <span className="text-sm italic opacity-70">
                      "What you seek is seeking you."
                    </span>
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map((item, index) => (
                  <ItemCard key={`${item.id}-${index}`} item={item} index={index} />
                ))}
              </div>
            )}
          </AnimatePresence>
          
          {items.length > 0 && (
            <div className="mt-12 text-center">
              <p className="text-sm text-amber-200/60 font-mono uppercase tracking-widest flex items-center justify-center gap-2">
                <Sparkles className="w-3 h-3" />
                {filteredItems.length} of {items.length} Artifacts Revealed
                <Sparkles className="w-3 h-3" />
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
