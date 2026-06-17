export { getUsuarioAtual as getUser, estaLogado, eAdmin } from "@/lib/auth";
export function useAuth() { return { user: null, setUser: (_: any) => {} }; }
