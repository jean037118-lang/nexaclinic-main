import { ShieldOff } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Props {
  mensagem?: string;
}

export function AcessoNegado({ mensagem }: Props) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <ShieldOff className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mensagem ?? "Você não tem permissão para acessar esta página."}
        </p>
      </div>
      <Link
        to="/"
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
