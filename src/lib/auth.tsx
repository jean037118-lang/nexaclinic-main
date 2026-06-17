```tsx
'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'

interface User {
  id: string
  nome: string
  email: string
  tipo: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, senha: string) => boolean
  logout: () => void
  temPermissao: (permissao: string) => boolean
}

const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType
)

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const usuarioSalvo = localStorage.getItem(
      'nexaclinic_usuario'
    )

    if (usuarioSalvo) {
      setUser(JSON.parse(usuarioSalvo))
    }

    setLoading(false)
  }, [])

  function login(email: string, senha: string) {
    const usuarioFake = {
      id: '1',
      nome: 'Jean',
      email,
      tipo: 'Administrador',
    }

    localStorage.setItem(
      'nexaclinic_usuario',
      JSON.stringify(usuarioFake)
    )

    setUser(usuarioFake)

    return true
  }

  function logout() {
    localStorage.removeItem('nexaclinic_usuario')
    window.location.href = '/login'
  }

  function temPermissao(permissao: string) {
    return true
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        temPermissao,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```
