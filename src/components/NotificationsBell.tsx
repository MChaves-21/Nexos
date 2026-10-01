import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

/** Sino com os avisos (limite estourado, conta vencendo, consentimento, resumo semanal...). */
const NotificationsBell = () => {
  const navigate = useNavigate();
  const { notifications, unread, markRead, remove } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Avisos: ${unread} não lidos` : "Avisos"}>
          <Bell className="h-5 w-5" aria-hidden />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive px-1 text-[11px] font-semibold leading-[18px] text-destructive-foreground" aria-hidden>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Avisos</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 h-8" onClick={() => markRead.mutate(notifications.filter((n) => !n.read_at).map((n) => n.id))}>
              <CheckCheck className="h-4 w-4" aria-hidden />Marcar como lidos
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum aviso por enquanto.</p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto divide-y" aria-label="Lista de avisos">
            {notifications.map((n) => (
              <li key={n.id} className={cn("flex gap-2 px-4 py-3", !n.read_at && "bg-primary/5")}>
                <button
                  className="flex-1 text-left space-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  onClick={() => {
                    if (!n.read_at) markRead.mutate([n.id]);
                    if (n.link) navigate(n.link);
                  }}
                >
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.body}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => remove.mutate(n.id)} aria-label={`Apagar aviso: ${n.title}`}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsBell;
