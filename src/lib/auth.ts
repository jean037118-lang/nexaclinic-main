export async function login(
  email: string,
  senha: string
): Promise<AppUser | null> {

  console.log("LOGIN", { email, senha });

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email)
    .eq("senha", senha)
    .eq("ativo", true);

  console.log("DATA:", data);
  console.log("ERROR:", error);

  if (error || !data || data.length === 0) {
    return null;
  }

  const usuario = data[0];

  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify(usuario)
  );

  return usuario;
}