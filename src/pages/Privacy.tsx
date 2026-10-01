import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Termos de uso e política de privacidade, em linguagem simples (LGPD). Página pública. */
const Privacy = () => (
  <div className="min-h-screen bg-background">
    <main className="container max-w-3xl py-8 sm:py-12 space-y-8">
      <Button asChild variant="ghost" size="sm" className="gap-2 -ml-2">
        <Link to="/"><ArrowLeft className="h-4 w-4" aria-hidden />Voltar ao Nexos</Link>
      </Button>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacidade e termos de uso</h1>
        <p className="text-muted-foreground">Em linguagem simples: o que o Nexos guarda, para quê e como você controla seus dados.</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">O que é o Nexos</h2>
        <p>Um app pessoal de controle financeiro, usado por uma família. Não é um banco, não movimenta dinheiro e não faz recomendação de investimento.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Quais dados guardamos</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Conta:</strong> seu e-mail e preferências de uso (modo simples ou completo, avisos).</li>
          <li><strong>Lançamentos seus:</strong> transações, metas, limites, contas a pagar e investimentos que você cadastra.</li>
          <li><strong>Dados do banco (se você conectar):</strong> contas, saldos, transações e investimentos lidos pelo Open Finance.</li>
          <li><strong>Arquivos de extrato:</strong> são lidos no seu navegador; guardamos só as transações, não o arquivo.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Conexão com o banco</h2>
        <p>
          A conexão é feita pelo <strong>Open Finance</strong>, por meio da Pluggy, uma empresa autorizada para isso. Você autoriza no app do seu
          banco; o Nexos <strong>nunca vê nem guarda sua senha do banco</strong>. O consentimento pode ser cancelado a qualquer momento no app
          do banco ou removendo a conexão aqui.
        </p>
        <p>
          Se você usar uma conta Pluggy própria, as credenciais dela ficam guardadas <strong>criptografadas</strong> e só o servidor do Nexos
          consegue usá-las.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Com quem os dados são compartilhados</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Supabase:</strong> onde o app e o banco de dados ficam hospedados.</li>
          <li><strong>Pluggy:</strong> só se você conectar um banco.</li>
          <li>
            <strong>Serviço de IA para categorias:</strong> a descrição de transações que nenhuma regra reconheceu (ex.: "Padaria Central") é
            enviada para sugerir a categoria. Valores e dados pessoais não são enviados.
          </li>
          <li><strong>Família:</strong> o administrador vê só o estado das suas conexões (conectado, com erro, consentimento vencendo), nunca seus valores ou transações.</li>
        </ul>
        <p>Não vendemos dados nem usamos para publicidade.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Seus direitos (LGPD)</h2>
        <p>Em <Link to="/account" className="underline">Conta e privacidade</Link> você pode, a qualquer momento:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Baixar todos os seus dados</strong> num arquivo.</li>
          <li><strong>Excluir sua conta</strong> e todos os dados. As conexões com bancos também são encerradas.</li>
          <li>Corrigir qualquer informação, editando no próprio app.</li>
        </ul>
        <p>Dúvidas: fale com o administrador do Nexos pelo e-mail no rodapé do app.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Termos de uso</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>As informações e simulações servem para organização pessoal e podem conter erros ou atrasos de sincronização. Confira sempre no seu banco.</li>
          <li>A ajuda para o Imposto de Renda é um resumo para facilitar; não substitui os informes oficiais nem um contador.</li>
          <li>Você é responsável por manter sua senha do Nexos em segredo.</li>
        </ul>
      </section>

      <p className="text-sm text-muted-foreground">Última atualização: outubro de 2026.</p>
    </main>
  </div>
);

export default Privacy;
