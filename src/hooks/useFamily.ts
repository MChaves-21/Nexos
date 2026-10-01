import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import type { MemberOverview } from "@/lib/family";
import type { Tables } from "@/integrations/supabase/types";

export type Family = Tables<"families">;
export type FamilyMember = Tables<"family_members">;
export type FamilyInvite = Tables<"family_invites">;

const onError = (title: string) => (e: unknown) => toast({ title, description: friendlyErrorMessage(e), variant: "destructive" });

/** Família da pessoa logada: membros, convites e o painel do administrador. */
export const useFamily = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["family"] });

  const { data, isLoading } = useQuery({
    queryKey: ["family", "me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      const [{ data: families, error: fErr }, { data: members, error: mErr }] = await Promise.all([
        supabase.from("families").select("*"),
        supabase.from("family_members").select("*").order("role").order("display_name"),
      ]);
      // Banco ainda sem as tabelas da família: trata como "sem família"
      if (fErr || mErr) return { family: null, members: [] as FamilyMember[], me: null, unavailable: true };
      const me = (members ?? []).find((m) => m.user_id === uid) ?? null;
      return { family: (families ?? [])[0] ?? null, members: members ?? [], me, unavailable: false };
    },
  });

  const isAdmin = data?.me?.role === "admin";

  const { data: overview = [] } = useQuery({
    queryKey: ["family", "overview"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("family_overview");
      if (error) throw error;
      return (data ?? []) as MemberOverview[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["family", "invites"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("family_invites").select("*").is("used_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FamilyInvite[];
    },
  });

  const createFamily = useMutation({
    mutationFn: async (v: { name: string; displayName: string }) => {
      const { error } = await supabase.rpc("create_family", { p_name: v.name, p_display_name: v.displayName });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Família criada", description: "Agora gere um convite para cada pessoa." }); },
    onError: onError("Não foi possível criar a família"),
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_family_invite");
      if (error) throw error;
      return data as string;
    },
    onSuccess: invalidate,
    onError: onError("Não foi possível gerar o convite"),
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_family_invite", { p_invite: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: onError("Não foi possível cancelar o convite"),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_family_member", { p_user: userId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Membro removido da família" }); },
    onError: onError("Não foi possível remover"),
  });

  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_family");
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: isAdmin ? "Família excluída" : "Você saiu da família" }); },
    onError: onError("Não foi possível sair"),
  });

  return { ...data, isLoading, isAdmin, overview, invites, createFamily, createInvite, revokeInvite, removeMember, leave };
};
