import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, CheckCircle } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsValidSession(true);
      } else {
        toast({
          title: "Link inválido ou expirado",
          description: "Solicite um novo link de recuperação de senha",
          variant: "destructive",
        });
        navigate("/auth");
      }
      setIsChecking(false);
    };

    // Listen for auth state changes (recovery link click)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true);
        setIsChecking(false);
      }
    });

    checkSession();

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("new-password") as string;
    const confirmPassword = formData.get("confirm-password") as string;

    if (password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas diferentes",
        description: "As senhas digitadas não coincidem",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setIsSuccess(true);
      toast({
        title: "Senha redefinida!",
        description: "Sua senha foi alterada com sucesso",
      });
    }

    setIsLoading(false);
  };

  if (isChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8 gap-3 opacity-0 animate-fade-in-up">
          <img src="/nexos-logo.webp" alt="NEXOS" className="h-12 w-12 rounded-lg shadow-md" fetchPriority="high" />
          <h1 className="text-4xl font-bold text-primary">NEXOS</h1>
        </div>

        <Card className="border-border/50 shadow-lg opacity-0 animate-scale-in" style={{ animationDelay: "0.2s" }}>
          <CardHeader>
            <CardTitle>
              {isSuccess ? "Senha Redefinida!" : "Redefinir Senha"}
            </CardTitle>
            <CardDescription>
              {isSuccess 
                ? "Sua senha foi alterada com sucesso" 
                : "Digite sua nova senha abaixo"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle className="h-16 w-16 text-emerald-500 dark:text-emerald-400" />
                </div>
                <p className="text-muted-foreground">
                  Você já pode acessar sua conta com a nova senha.
                </p>
                <Button 
                  className="w-full" 
                  onClick={() => navigate("/")}
                >
                  Ir para o Dashboard
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      name="new-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      required
                      minLength={6}
                      disabled={!isValidSession}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo de 6 caracteres. Evite sequências simples como "123456"
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      required
                      minLength={6}
                      disabled={!isValidSession}
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || !isValidSession}
                >
                  {isLoading ? "Redefinindo..." : "Redefinir Senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ResetPassword;
