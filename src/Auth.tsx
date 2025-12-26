import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Button } from './components/ui/button'
import { useToast } from './components/ui/toast'

export const Auth = () => {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const toast = useToast()

  // ログイン処理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast(error.message, 'error')
    }
    setLoading(false)
  }

  // 新規登録処理
  // 新規登録は無効化しています（サーバー側での制御を推奨）。
  // 以前はここに signUp のハンドラがありましたが、UIからの新規登録を許可しないため削除しています。

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg border border-border">
        <h1 className="text-2xl font-bold text-center mb-2 text-foreground">工数管理システム</h1>
        <p className="text-center text-muted-foreground mb-6">メールアドレスでログイン</p>
        <form className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleLogin} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? '処理中...' : 'ログイン'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}