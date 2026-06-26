import { useState } from "react";
import { Controls } from "@/components/Controls";
import { ItemCard } from "@/components/ItemCard";
import { useDrawItems } from "@/hooks/use-items";
import type { ItemResponse } from "@shared/routes";
import type { DrawOptions } from "@shared/schema";
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
    } catch {
      // Error handled in hook via toast
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0 border-b md:border-b-0 md:border-r border-border h-[30vh] md:h-full overflow-hidden">
        <Controls
          onDraw={handleDraw}
          isDrawing={drawItemsMutation.isPending}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 relative scrollbar-fantasy">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

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
                <div className="w-32 h-32 rounded-full bg-card border-4 border-border flex items-center justify-center shadow-2xl shadow-primary/10">
                  <Scroll className="w-16 h-16 text-muted-foreground" />
                </div>
                <div className="max-w-md space-y-2">
                  <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                    Awaiting Destiny
                  </h1>
                  <p className="text-muted-foreground font-serif text-lg">
                    Select your criteria and draw your fate.
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
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest opacity-50 flex items-center justify-center gap-2">
                <Sparkles className="w-3 h-3" />
                {filteredItems.length} of {items.length} Items Revealed
                <Sparkles className="w-3 h-3" />
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
