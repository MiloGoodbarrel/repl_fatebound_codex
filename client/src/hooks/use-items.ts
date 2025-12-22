import { useMutation } from "@tanstack/react-query";
import { api, type DrawOptions, type ItemResponse } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useDrawItems() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: DrawOptions) => {
      // Validate with Zod before sending
      const validated = api.items.draw.input.parse(options);
      
      const res = await fetch(api.items.draw.path, {
        method: api.items.draw.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const errorData = await res.json();
          // Try to parse as validation error schema
          try {
            const parsedError = api.items.draw.responses[400].parse(errorData);
            throw new Error(parsedError.message);
          } catch {
             throw new Error("Invalid draw parameters");
          }
        }
        throw new Error("Failed to draw cards from the deck of many things");
      }

      const data = await res.json();
      return api.items.draw.responses[200].parse(data);
    },
    onError: (error) => {
      toast({
        title: "The Deck Resists",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
