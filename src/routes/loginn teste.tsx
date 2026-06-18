export async function login(
  email: string,
  senha: string
): Promise<AppUser | null> {

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email);

  console.log("EMAIL:", email);
  console.log("SENHA:", senha);
  console.log("DATA:", data);
  console.log("ERROR:", error);

  return null;
}