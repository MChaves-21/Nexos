import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHOW_MORE_PAGE } from "@/hooks/useShowMore";

interface ShowMoreButtonProps {
  remaining: number;
  onClick: () => void;
  pageSize?: number;
}

/** Botão "Ver mais" do fim das listas; some quando não há mais itens. */
const ShowMoreButton = ({ remaining, onClick, pageSize = SHOW_MORE_PAGE }: ShowMoreButtonProps) => {
  if (remaining <= 0) return null;
  return (
    <Button variant="outline" className="w-full gap-1 min-h-[44px]" onClick={onClick}>
      <ChevronDown className="h-4 w-4" aria-hidden />
      Ver mais {Math.min(pageSize, remaining)}
      <span className="text-muted-foreground font-normal">({remaining} restantes)</span>
    </Button>
  );
};

export default ShowMoreButton;
